import { CloudflareApiBase } from './base';

// ── Cloudflare Zone shape ────────────────────────────────────────────────────

export interface CfZone {
    id: string;
    name: string;
    status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
    paused: boolean;
    type: 'full' | 'partial' | 'secondary';
    account: { id: string; name: string };
    plan?: { name: string; price: number };
    modified_on: string;
    created_on: string;
}

export class ZonesApi extends CloudflareApiBase {
    /**
     * Fetches ALL zones accessible in the account.
     * Handles pagination — CF returns at most 50 zones per page.
     */
    async getZones(): Promise<CfZone[]> {
        const allZones: CfZone[] = [];
        let page = 1;
        const perPage = 50;

        while (true) {
            const payload = await this.fetchRestFull<CfZone[]>(
                `/zones?account.id=${this.cfAccountId}&per_page=${perPage}&page=${page}`
            );

            allZones.push(...payload.result);

            // Stop when we've fetched all pages.
            const totalPages = payload.result_info?.total_pages ?? 1;
            if (page >= totalPages) break;
            page++;
        }

        return allZones;
    }

    /**
     * Gets the security level for a zone.
     * Returns: 'off' | 'essentially_off' | 'low' | 'medium' | 'high' | 'under_attack'
     */
    async getSecurityLevel(zoneId: string): Promise<string> {
        const response = await this.fetchRest<{ id: string; value: string }>(
            `/zones/${zoneId}/settings/security_level`
        );
        return response.value;
    }

    /**
     * Sets the security level for a zone.
     */
    async setSecurityLevel(
        zoneId: string,
        level: 'under_attack' | 'essentially_off' | 'low' | 'medium' | 'high'
    ): Promise<void> {
        await this.fetchRest(
            `/zones/${zoneId}/settings/security_level`,
            {
                method: 'PATCH',
                body: JSON.stringify({ value: level }),
            }
        );
    }
}
