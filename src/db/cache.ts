import { entityCache } from './schema/cloudflare';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * PostgreSQL-backed generic cache for CF entity set membership.
 *
 * Key concept: each "namespace" is an isolated bucket (e.g. `cf_list:abc123`).
 * Within a namespace, each `key` is a member of that set (e.g. an IP address).
 *
 * Usage pattern:
 *   1. `getAll(ns)` — fetch the known set before each operation
 *   2. `add(ns, keys)` — call after a successful CF add
 *   3. `remove(ns, keys)` — call after a successful CF delete
 *   4. `sync(ns, keys)` — call after a full GET-from-CF re-sync (replaces all rows)
 */
export class CacheStore {
    constructor(private db: any) {}

    /**
     * Returns all cached keys for a namespace as a Set.
     * Returns an empty Set if there is no cache entry (cold start).
     */
    async getAll(namespace: string): Promise<Set<string>> {
        const rows = await this.db
            .select({ key: entityCache.key })
            .from(entityCache)
            .where(eq(entityCache.namespace, namespace));
        return new Set(rows.map((r: any) => r.key));
    }

    /**
     * Inserts keys into the namespace cache (on successful CF add).
     * Uses INSERT OR IGNORE so concurrent runs never fail on conflicts.
     */
    async add(namespace: string, keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        const now = new Date();
        await this._bulkInsert(namespace, keys, now);
    }

    /**
     * Removes specific keys from the namespace cache (on successful CF delete).
     */
    async remove(namespace: string, keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await this.db
            .delete(entityCache)
            .where(
                and(
                    eq(entityCache.namespace, namespace),
                    inArray(entityCache.key, keys)
                )
            );
    }

    /**
     * Replaces ALL keys for a namespace with a fresh set from CF.
     * Used after a GET-from-CF re-sync to correct any stale cache state.
     */
    async sync(namespace: string, keys: string[]): Promise<void> {
        const now = new Date();
        // Delete existing rows for this namespace, then bulk-insert the fresh set.
        await this.db
            .delete(entityCache)
            .where(eq(entityCache.namespace, namespace));

        if (keys.length > 0) {
            await this._bulkInsert(namespace, keys, now);
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private async _bulkInsert(namespace: string, keys: string[], syncedAt: Date): Promise<void> {
        const rows = keys.map(key => ({ namespace, key, syncedAt }));
        await this.db.insert(entityCache).values(rows).onConflictDoNothing();
    }
}
