import { CloudflareApiBase } from '~/lib/cloudflare/base';

// ── Cloudflare List metadata (returned by getLists) ───────────────────────────

export interface CfList {
    id: string;
    name: string;
    description: string;
    kind: 'ip' | 'redirect' | 'hostname' | 'asn';
    num_items: number;
    num_referencing_filters: number;
    created_on: string;
    modified_on: string;
}

// ── Cloudflare List item ───────────────────────────────────────────────────────

export interface ListItem {
    id: string;
    ip?: string;
    asn?: number;
    hostname?: string;
    comment?: string;
    created_on: string;
    modified_on: string;
}

// ── Payloads sent to the API ───────────────────────────────────────────────────

export interface ListItemInput {
    ip?: string;
    asn?: number;
    hostname?: string;
    comment?: string;
}

// ── Result shape for addItemsSafe ─────────────────────────────────────────────

export interface AddItemsSafeResult {
    added: ListItemInput[];
    alreadyInList: ListItemInput[];
    failed: ListItemInput[];
    operationIds: string[];
}

// ── CF API error codes for duplicate items ────────────────────────────────────
// Code 10005 = "list item already exists" (IP lists)
// Code 10006 = "duplicate value" (redirect / hostname lists)
// Using codes rather than message substrings avoids brittle i18n-sensitive checks.
const CF_DUPLICATE_CODES = new Set([10005, 10006]);

function isDuplicateError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    // Fast code-based check: parse the JSON error array stored in the message.
    try {
        // Message format: "Cloudflare REST API Error (400): [{"code":10005,...}]"
        const jsonStart = err.message.indexOf('[');
        if (jsonStart !== -1) {
            const errors: { code: number }[] = JSON.parse(err.message.slice(jsonStart));
            if (errors.some(e => CF_DUPLICATE_CODES.has(e.code))) return true;
        }
    } catch {
        // JSON parsing failed — fall back to substring match as a safety net.
    }
    // Fallback: substring match for environments that expose a plain-text message.
    const msg = err.message.toLowerCase();
    return msg.includes('duplicate') || msg.includes('already exists');
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** CF allows at most 1 000 item IDs per DELETE request. */
const CF_DELETE_CHUNK_SIZE = 1_000;

// ─────────────────────────────────────────────────────────────────────────────

export class ListsApi extends CloudflareApiBase {
    /**
     * Fetches all Lists in the account.
     */
    async getLists(): Promise<CfList[]> {
        return this.fetchRest<CfList[]>(`/accounts/${this.cfAccountId}/rules/lists`);
    }

    /**
     * Fetches all items in a Cloudflare List.
     * Handles cursor-based pagination automatically.
     *
     * @param limit - Optional cap on the number of items returned.
     */
    async getItems(cfListId: string, limit?: number): Promise<ListItem[]> {
        const items: ListItem[] = [];
        let cursor: string | undefined;

        do {
            const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
            const endpoint = `/accounts/${this.cfAccountId}/rules/lists/${cfListId}/items${query}`;
            const payload = await this.fetchRestFull<ListItem[]>(endpoint);

            items.push(...payload.result);

            if (limit !== undefined && items.length >= limit) {
                return items.slice(0, limit);
            }

            cursor = payload.result_info?.cursors?.after;
        } while (cursor);

        return items;
    }

    /**
     * Deletes multiple items from a list.
     *
     * CF allows at most 1 000 IDs per DELETE request, so large batches are
     * automatically chunked. Returns all operation IDs from every chunk.
     */
    async deleteItems(cfListId: string, itemIds: string[]): Promise<string[]> {
        if (itemIds.length === 0) return [];

        const operationIds: string[] = [];

        for (let i = 0; i < itemIds.length; i += CF_DELETE_CHUNK_SIZE) {
            const chunk = itemIds.slice(i, i + CF_DELETE_CHUNK_SIZE);
            const result = await this.fetchRest<{ operation_id?: string }>(
                `/accounts/${this.cfAccountId}/rules/lists/${cfListId}/items`,
                {
                    method: 'DELETE',
                    body: JSON.stringify({ items: chunk.map(id => ({ id })) }),
                }
            );
            if (result?.operation_id) operationIds.push(result.operation_id);
        }

        return operationIds;
    }

    /**
     * Adds items to a list in a single API call.
     * Returns the CF operation ID, or null if the response didn't include one.
     */
    async addItems(cfListId: string, items: ListItemInput[]): Promise<string | null> {
        const result = await this.fetchRest<{ operation_id?: string }>(
            `/accounts/${this.cfAccountId}/rules/lists/${cfListId}/items`,
            {
                method: 'POST',
                body: JSON.stringify(items),
            }
        );
        return result?.operation_id ?? null;
    }

    /**
     * Safely adds items to a CF list.
     *
     * With CacheStore handling deduplication upstream in the rule handler,
     * this simply attempts a single batch POST.
     *
     * On a duplicate error (shouldn't happen with a warm cache, but can on
     * cold start) the items are returned as `alreadyInList` so the caller
     * can re-sync its cache and retry. Any other error is re-thrown.
     */
    async addItemsSafe(
        cfListId: string,
        items: ListItemInput[]
    ): Promise<AddItemsSafeResult> {
        if (items.length === 0) {
            return { added: [], alreadyInList: [], failed: [], operationIds: [] };
        }

        try {
            const operationId = await this.addItems(cfListId, items);
            return {
                added: items,
                alreadyInList: [],
                failed: [],
                operationIds: operationId ? [operationId] : [],
            };
        } catch (err) {
            if (!isDuplicateError(err)) throw err;
            // Surface duplicates to the caller so it can re-sync its cache.
            return { added: [], alreadyInList: items, failed: [], operationIds: [] };
        }
    }
}
