import { RuleHandlers } from './rules/index';
import { CloudflareClient } from '@flarestack/cloudflare';
import { ActionLogger } from './lib/actions/logger';
import { CacheStore } from '@flarestack/db/src/cache';
import { log } from './lib/log';

import { cloudflareAccounts } from '@flarestack/db/src/schema/zones';
import { ZoneConfig } from './rules/interface';

// Shape of a pre-loaded account row from cron.ts.
type AccountRow = typeof cloudflareAccounts.$inferSelect;

export class RuleEngine {
    // Cache CloudflareClient per account to avoid redundant allocations
    // when multiple zones share the same CF account.
    private clientCache = new Map<string, CloudflareClient>();

    /**
     * @param accountMap   Pre-loaded map of cfAccountRef → account row.
     * @param actionLogger Shared across all zones — stateless, safe to reuse.
     * @param cacheStore   Shared D1 entity cache — namespace-isolated, safe to reuse.
     */
    constructor(
        private accountMap: Map<string, AccountRow>,
        private actionLogger: ActionLogger,
        private cacheStore: CacheStore,
        private env?: any
    ) { }

    /**
     * Returns a cached CloudflareClient for the given account, creating
     * one on first access.
     */
    private getClient(account: AccountRow): CloudflareClient {
        let client = this.clientCache.get(account.id);
        if (!client) {
            client = new CloudflareClient(account.cfAccountId, account.cfApiToken);
            this.clientCache.set(account.id, client);
        }
        return client;
    }

    /**
     * Executes all rules for a zone.
     *
     * Both `activeRules` and (optionally) `prefetchedIpsByZone` are supplied
     * by the cron orchestrator — this method performs ZERO D1 or analytics
     * round-trips on its own.
     */
    async processZone(
        zone: ZoneConfig,
        activeRules: any[],
        prefetchedIpsByZone?: Map<string, { ip: string; count: number }[]>
    ): Promise<void> {
        log(`\nProcessing zone: ${zone.name} (${zone.cfZoneId})`);

        // 1. O(1) account lookup — no DB query.
        const account = this.accountMap.get(zone.cfAccountRef);
        if (!account) {
            console.error(
                `No CF account found for zone ${zone.name} (cfAccountRef=${zone.cfAccountRef})`
            );
            return;
        }

        const cf = this.getClient(account);

        if (activeRules.length === 0) {
            log(`Zone ${zone.name} has no active rules. Skipping.`);
            return;
        }

        // 2. Determine which rules are due this cycle and dispatch them.
        //    Drift tolerance: accepts current minute OR current-1 minute
        //    so a slightly late cron still fires.
        const minutesSinceEpoch = Math.floor(Date.now() / (60 * 1000));

        const ruleSettled = await Promise.allSettled(
            activeRules.map(async (rule) => {
                const windowSeconds = rule.windowSeconds ?? 300;
                const intervalMins = Math.max(1, Math.floor(windowSeconds / 60));

                const currentSlot = minutesSinceEpoch % intervalMins;
                const isDue = currentSlot === 0 || currentSlot === intervalMins - 1;

                if (!isDue) {
                    const nextSlotEpochMs =
                        (minutesSinceEpoch + (intervalMins - currentSlot)) * 60 * 1000;
                    const nextSlotUTC = new Date(nextSlotEpochMs).toISOString().slice(11, 16) + ' UTC';
                    log(
                        `  Skipping rule ${rule.id} (runs every ${intervalMins}m, next at ${nextSlotUTC})`
                    );
                    return;
                }

                const handler = RuleHandlers[rule.type];
                if (!handler) {
                    console.error(`No handler registered for rule type: ${rule.type}`);
                    return;
                }

                log(`  Executing rule ${rule.id} (type=${rule.type}, interval=${intervalMins}m)`);

                // Pass pre-fetched IPs if available (from batched GQL).
                const prefetchedIps = prefetchedIpsByZone?.get(zone.cfZoneId);

                await handler.execute({
                    zone,
                    rule,
                    cf,
                    actionLogger: this.actionLogger,
                    cacheStore: this.cacheStore,
                    prefetchedIps,
                    env: this.env,
                });
            })
        );

        // Surface any unhandled rule-level errors.
        ruleSettled.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(
                    `  Rule "${activeRules[i].id}" (type=${activeRules[i].type}) threw an unhandled error:`,
                    result.reason
                );
            }
        });
    }
}
