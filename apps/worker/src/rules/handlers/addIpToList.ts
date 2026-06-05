import { RuleHandler, RuleContext, AddIpToListRuleRow } from '../interface';
import { log } from '../../lib/log';
import type { ListItemInput } from '@flarestack/cloudflare';

export class AddIpToListRule implements RuleHandler {
    /**
     * Queries Cloudflare Analytics for IPs exceeding the rule's threshold,
     * deduplicates against the D1 entity cache, adds only genuinely new IPs
     * via a single batch POST, then writes audit logs.
     */
    async execute({ zone, rule: baseRule, cf, actionLogger, cacheStore, prefetchedIps }: RuleContext): Promise<void> {
        const rule = baseRule as AddIpToListRuleRow;
        log(
            `  Rule [add_ip_to_list] id=${rule.id} list=${rule.cfListId} ` +
            `threshold=${rule.rateLimitThreshold} window=${rule.windowSeconds}s`
        );

        // Guard: validate required rule fields at runtime.
        const { cfListId, rateLimitThreshold, windowSeconds: ruleWindowSeconds } = rule;
        if (!cfListId || typeof rateLimitThreshold !== 'number' || typeof ruleWindowSeconds !== 'number') {
            console.error(
                `  Rule ${rule.id} has invalid configuration — skipping.`,
                { cfListId, rateLimitThreshold, windowSeconds: ruleWindowSeconds }
            );
            return;
        }

        // ── 1. Resolve flagged IPs ─────────────────────────────────────────────
        let flaggedIPs: { ip: string; count: number }[] = [];

        if (prefetchedIps) {
            // Re-filter against THIS rule's threshold — the batched query used
            // the lowest threshold across all rules on this zone.
            flaggedIPs = prefetchedIps.filter(({ count }) => count > rateLimitThreshold);
            log(`  Using ${flaggedIPs.length} pre-fetched flagged IP(s) for rule ${rule.id} (filtered from ${prefetchedIps.length}).`);
        } else {
            try {
                const results = await cf.analytics.getTopStats({
                    zoneTag: zone.cfZoneId,
                    dimensions: ['clientIP'],
                    windowSeconds: ruleWindowSeconds,
                    limit: 10000,
                    latencyOffsetSeconds: 60,
                });
                flaggedIPs = results
                    .filter(r => r.count > rateLimitThreshold)
                    .map(r => ({ ip: String(r['clientIP']), count: r.count as number }));
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to query abusive IPs for rule ${rule.id} on zone ${zone.name}:`, errMsg);
                await actionLogger.logActions([{
                    userId: zone.userId,
                    zoneConfigId: zone.id,
                    ruleId: rule.id,
                    actionTaken: 'IP_ADDED_TO_LIST_ERROR',
                    targetType: 'API_ERROR',
                    targetValue: 'Abusive IPs query failed',
                    requestCount: null,
                    metadata: JSON.stringify({ error: errMsg }),
                    timestamp: new Date()
                }]);
                return;
            }
        }

        if (flaggedIPs.length === 0) {
            log(`  No IPs exceeded threshold for rule ${rule.id}.`);
            return;
        }

        // ── 2. Deduplicate against the entity cache ────────────────────────────
        const namespace = `cf_list:${cfListId}`;
        let cached = await cacheStore.getAll(namespace);

        // Cold start: cache is empty — fetch the live list from CF to populate it.
        if (cached.size === 0) {
            log(`  Cache miss for ${namespace}. Fetching live list from CF…`);
            try {
                // Cold-start: O(list_size) — paginates through ALL items in the CF list.
                // This only fires once per list (first cron run after deploy or after
                // a cache-clearing event such as a zone/rule deletion). All subsequent
                // runs take the warm path (1 D1 read + 1 POST).
                const liveItems = await cf.lists.getItems(cfListId);
                const liveIps = liveItems.map(i => i.ip).filter((ip): ip is string => !!ip);
                await cacheStore.sync(namespace, liveIps);
                cached = new Set(liveIps);
                log(`  Cache populated with ${cached.size} existing IP(s).`);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to fetch live list for ${cfListId}:`, errMsg);
                await actionLogger.logActions([{
                    userId: zone.userId,
                    zoneConfigId: zone.id,
                    ruleId: rule.id,
                    actionTaken: 'IP_ADDED_TO_LIST_ERROR',
                    targetType: 'API_ERROR',
                    targetValue: errMsg.substring(0, 100),
                    requestCount: null,
                    metadata: JSON.stringify({ error: errMsg }),
                    timestamp: new Date()
                }]);
                return;
            }
        }

        const alreadyInList = flaggedIPs.filter(({ ip }) => cached.has(ip));
        const newItems = flaggedIPs.filter(({ ip }) => !cached.has(ip));

        if (alreadyInList.length > 0) {
            const preview = alreadyInList.length > 10
                ? `${alreadyInList.slice(0, 10).map(i => i.ip).join(', ')} … (+${alreadyInList.length - 10} more)`
                : alreadyInList.map(i => i.ip).join(', ');
            log(`  ${alreadyInList.length} IP(s) already in list (cache hit): ${preview}`);
        }

        if (newItems.length === 0) {
            log(`  No new IPs to add for rule ${rule.id}.`);
            return;
        }

        log(`  ${newItems.length} new IP(s) to add. Submitting batch to CF list…`);

        // ── 3. Batch POST only the new items (guaranteed no duplicates) ────────
        const comment = `FlareStack auto-added ${new Date().toISOString()}`;
        const payload: ListItemInput[] = newItems.map(({ ip }) => ({ ip, comment }));

        let operationId: string | null = null;
        try {
            operationId = await cf.lists.addItems(cfListId, payload);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Unexpected failure — re-sync cache from CF, then abort.
            // A duplicate error here would be a cache bug; any other error is
            // an auth/network issue. Either way, refreshing the cache is correct.
            console.error(`  CF list add failed for rule ${rule.id}:`, errMsg);
            await actionLogger.logActions([{
                userId: zone.userId,
                zoneConfigId: zone.id,
                ruleId: rule.id,
                actionTaken: 'IP_ADDED_TO_LIST_ERROR',
                targetType: 'API_ERROR',
                targetValue: 'List update failed',
                requestCount: newItems.length,
                metadata: JSON.stringify({ error: errMsg }),
                timestamp: new Date()
            }]);
            try {
                const liveItems = await cf.lists.getItems(cfListId);
                const liveIps = liveItems.map(i => i.ip).filter((ip): ip is string => !!ip);
                await cacheStore.sync(namespace, liveIps);
                log(`  Cache re-synced after failure (${liveIps.length} items).`);
            } catch (syncErr) {
                console.error(`  Cache re-sync also failed:`, syncErr instanceof Error ? syncErr.message : syncErr);
            }
            return;
        }

        // ── 4. Update cache with the newly added IPs ───────────────────────────
        const newIps = newItems.map(i => i.ip);
        await cacheStore.add(namespace, newIps);

        // ── 5. Batch-insert audit log entries ONLY for newly added IPs ─────────
        const metadata = JSON.stringify({ cfListId, cfOperationId: operationId });
        const now = new Date();

        await actionLogger.logActions(
            newItems.map(({ ip, count }) => ({
                userId: zone.userId,
                zoneConfigId: zone.id,
                ruleId: rule.id,
                actionTaken: 'IP_ADDED_TO_LIST',
                targetType: 'IP',
                targetValue: ip,
                requestCount: count,
                metadata,
                timestamp: now,
            }))
        );

        log(
            `  Done. Added: ${newItems.length}, Already in list: ${alreadyInList.length}. ` +
            (operationId ? `CF operation: ${operationId}` : '')
        );
    }
}
