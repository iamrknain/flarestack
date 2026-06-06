import { cfListItemsCache } from './schema/cloudflare';
import { eq, and, inArray, ilike, or, sql } from 'drizzle-orm';
import type { ListItem, ListItemInput } from '~/lib/cloudflare';

// Matches CF's own IP/ASN/hostname value patterns — used to route search strategy
const isValueQuery = (q: string): boolean =>
    /^[a-fA-F0-9.:/*\-]+$/.test(q.trim()) || /^(as|AS)?[0-9]+$/.test(q.trim());

const BATCH_SIZE = 500;

/**
 * DB-backed cache for a single Cloudflare List.
 *
 * Two persistent tiers:
 *   db — PostgreSQL (cfListItemsCache table)
 *   cf — Cloudflare API (source of truth)
 *
 * Primary key is (cfListId, value) — the natural key (ip | asn | hostname).
 * Known immediately on write → no CF roundtrip needed in syncAfterAdd.
 * CF UUID (id) is nullable: populated during fullSync, used only for CF deletes.
 *
 * Responsibilities:
 *   - `syncAfterAdd`    — after caller CF write: insert rows into db directly (zero CF reads)
 *   - `syncAfterRemove` — after caller CF delete: remove rows from db by natural value
 *   - `fullSync`        — read all items from CF → replace all db rows (populates CF UUIDs)
 *   - `search`          — db first (ILIKE); throws CACHE_REQUIRED if db is cold
 *   - `getIpSet`        — db read → Set<string>; falls back to CF + populates db if cold
 *   - `status`          — db row count + syncedAt for the UI
 *
 * CF writes (addItems / deleteItems) always stay in the caller.
 * This class handles db reads/writes and CF reads only.
 */
export class ListCache {
    constructor(
        private db: any,
        private cf: any,
        private listId: string
    ) {}

    // ── Writes ────────────────────────────────────────────────────────────────

    /**
     * Called AFTER a successful CF add.
     * Inserts rows directly into db using the natural value key — zero CF reads.
     * id (CF UUID) is left null; populated on next fullSync.
     * No-op if the db cache is cold.
     */
    async syncAfterAdd(items: ListItemInput[]): Promise<void> {
        if (!(await this._hasCache())) return;
        if (items.length === 0) return;

        const now = new Date();
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            await this.db.insert(cfListItemsCache)
                .values(items.slice(i, i + BATCH_SIZE).map(item => ({
                    cfListId:   this.listId,
                    value:      this._valueFor(item),
                    id:         null,                  // CF UUID unknown until next fullSync
                    ip:         item.ip         ?? null,
                    asn:        item.asn        ?? null,
                    hostname:   item.hostname   ?? null,
                    comment:    item.comment    ?? null,
                    createdOn:  now,
                    modifiedOn: now,
                    syncedAt:   now,
                })))
                .onConflictDoUpdate({
                    target: [cfListItemsCache.cfListId, cfListItemsCache.value],
                    set: {
                        comment:    sql`excluded.comment`,
                        modifiedOn: sql`excluded.modified_on`,
                        syncedAt:   sql`excluded.synced_at`,
                    },
                });
        }
    }

    /**
     * Called AFTER a successful CF delete.
     * Removes rows from the db by their natural value (ip | asn.toString() | hostname).
     */
    async syncAfterRemove(values: string[]): Promise<void> {
        if (values.length === 0) return;
        await this.db
            .delete(cfListItemsCache)
            .where(and(
                eq(cfListItemsCache.cfListId, this.listId),
                inArray(cfListItemsCache.value, values)
            ));
    }

    /**
     * Resolves CF item UUIDs for the given values (ip | asn | hostname).
     * Strategy:
     *   1. Bulk db lookup by value — fast, zero CF reads for items with known UUIDs
     *   2. For any value with id = null (added since last fullSync): targeted CF search
     * Used by deleteListItemsAction so callers only need to know values, not CF UUIDs.
     */
    async resolveIds(values: string[]): Promise<string[]> {
        if (values.length === 0) return [];

        // Step 1: bulk db lookup
        const rows = await this.db
            .select({ value: cfListItemsCache.value, id: cfListItemsCache.id })
            .from(cfListItemsCache)
            .where(and(
                eq(cfListItemsCache.cfListId, this.listId),
                inArray(cfListItemsCache.value, values)
            ));

        const idMap = new Map<string, string | null>(rows.map((r: any) => [r.value, r.id]));
        const resolvedIds: string[] = [];

        // Separate: values with known UUID (from db) vs values needing CF lookup
        const knownIds: string[]  = [];
        const needLookup: string[] = [];
        for (const v of values) {
            const id = idMap.get(v);
            if (id) knownIds.push(id);
            else needLookup.push(v);
        }
        resolvedIds.push(...knownIds);

        // Parallel CF searches for values with null / missing UUID
        if (needLookup.length > 0) {
            const cfResults = await Promise.all(
                needLookup.map(async v => {
                    try {
                        const found: ListItem[] = await this.cf.lists.getItems(this.listId, 1, v);
                        return found.find((f: ListItem) =>
                            f.ip === v || f.asn?.toString() === v || f.hostname === v
                        )?.id ?? null;
                    } catch { return null; }
                })
            );
            resolvedIds.push(...cfResults.filter((id): id is string => id !== null));
        }

        return resolvedIds;
    }

    /**
     * Full rebuild from CF — replaces all db rows for this list.
     * Populates CF UUIDs (id column). Called by the Cache button.
     * Returns the number of items synced.
     */
    async fullSync(): Promise<number> {
        const items: ListItem[] = await this.cf.lists.getItems(this.listId);
        const now = new Date();

        // Atomic: delete + insert in one transaction — no window where cache is empty
        await this.db.transaction(async (tx: any) => {
            await tx.delete(cfListItemsCache).where(eq(cfListItemsCache.cfListId, this.listId));
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                await tx.insert(cfListItemsCache)
                    .values(items.slice(i, i + BATCH_SIZE).map((item: ListItem) => this._toRow(item, now)))
                    .onConflictDoNothing();
            }
        });

        return items.length;
    }

    /**
     * Clears all cached items for this list from the database.
     */
    async clear(): Promise<void> {
        await this.db
            .delete(cfListItemsCache)
            .where(eq(cfListItemsCache.cfListId, this.listId));
    }

    // ── Reads ─────────────────────────────────────────────────────────────────

    /**
     * Smart search:
     *   - empty query           → CF (fetch first N items, no filter)
     *   - IP / ASN / hostname   → CF prefix match (fast, server-side)
     *   - description / comment → db ILIKE if warm; throws CACHE_REQUIRED if cold
     */
    async search(query: string, limit?: number, bypassCache = false): Promise<ListItem[]> {
        if (bypassCache) {
            // Bypass DB cache completely, query directly from Cloudflare
            return this.cf.lists.getItems(this.listId, limit, isValueQuery(query) ? query : undefined);
        }

        if (!query) {
            return this.cf.lists.getItems(this.listId, limit);
        }

        // Value-type query → CF directly (server-side prefix match, fast)
        if (isValueQuery(query)) {
            return this.cf.lists.getItems(this.listId, limit, query);
        }

        // Description query — db first
        if (await this._hasCache()) {
            const rows = await this.db
                .select()
                .from(cfListItemsCache)
                .where(and(
                    eq(cfListItemsCache.cfListId, this.listId),
                    or(
                        ilike(cfListItemsCache.comment,  `%${query}%`),
                        ilike(cfListItemsCache.ip,       `%${query}%`),
                        ilike(cfListItemsCache.hostname, `%${query}%`)
                    )
                ))
                .limit(limit ?? 5000);
            return rows.map(this._fromRow);
        }

        // db cold — refuse to scan all CF pages (hangs on large lists)
        throw Object.assign(
            new Error('Build the cache first to enable description search (click the Cache button).'),
            { code: 'CACHE_REQUIRED' }
        );
    }

    /**
     * Returns a Set of all IP strings — used by the cron for dedup.
     * Reads from db if warm; falls back to CF + populates db if cold.
     */
    async getIpSet(): Promise<Set<string>> {
        if (await this._hasCache()) {
            const rows = await this.db
                .select({ ip: cfListItemsCache.ip })
                .from(cfListItemsCache)
                .where(eq(cfListItemsCache.cfListId, this.listId));
            return new Set(rows.map((r: any) => r.ip).filter(Boolean));
        }

        // Cold — full sync from CF (builds db cache as side-effect)
        const items: ListItem[] = await this.cf.lists.getItems(this.listId);
        const now = new Date();
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            await this.db.insert(cfListItemsCache)
                .values(items.slice(i, i + BATCH_SIZE).map(item => this._toRow(item, now)))
                .onConflictDoNothing();
        }
        return new Set(items.map(i => i.ip).filter(Boolean) as string[]);
    }

    /**
     * Returns cache metadata for the UI status indicator.
     */
    async status(): Promise<{ cached: boolean; count: number; syncedAt: Date | null }> {
        const result = await this.db
            .select({
                count:    sql<number>`count(*)`,
                syncedAt: sql<Date>`max(${cfListItemsCache.syncedAt})`,  // latest sync, not a random row
            })
            .from(cfListItemsCache)
            .where(eq(cfListItemsCache.cfListId, this.listId));
        const count = Number(result[0]?.count ?? 0);
        return { cached: count > 0, count, syncedAt: result[0]?.syncedAt ?? null };
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async _hasCache(): Promise<boolean> {
        const result = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(cfListItemsCache)
            .where(eq(cfListItemsCache.cfListId, this.listId));
        return Number(result[0]?.count ?? 0) > 0;
    }

    /** Natural key for an item — the value CF uses as the member of the list. */
    private _valueFor(item: ListItem | ListItemInput): string {
        return item.ip ?? (item.asn != null ? String(item.asn) : undefined) ?? (item as any).hostname ?? '';
    }

    /** Converts a CF ListItem into a db row (with real UUID). */
    private _toRow(item: ListItem, syncedAt: Date) {
        return {
            cfListId:   this.listId,
            value:      this._valueFor(item),
            id:         item.id,
            ip:         item.ip         ?? null,
            asn:        item.asn        ?? null,
            hostname:   item.hostname   ?? null,
            comment:    item.comment    ?? null,
            createdOn:  item.created_on  ? new Date(item.created_on)  : null,
            modifiedOn: item.modified_on ? new Date(item.modified_on) : null,
            syncedAt,
        };
    }

    /** Converts a db row back into a CF ListItem shape. */
    private _fromRow(row: any): ListItem {
        return {
            id:          row.id       ?? '',   // null until fullSync — empty string signals no UUID
            ip:          row.ip       ?? undefined,
            asn:         row.asn      ?? undefined,
            hostname:    row.hostname ?? undefined,
            comment:     row.comment  ?? undefined,
            created_on:  row.createdOn?.toISOString()  ?? '',
            modified_on: row.modifiedOn?.toISOString() ?? '',
        };
    }
}
