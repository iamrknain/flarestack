"use server";

import { debugLog } from "~/lib/debug";
import { ActionLogger } from "~/lib/logger";
import { CacheStore } from "~/db/cache";
import { CloudflareClient, type TopStatRow, type ListItem } from "~/lib/cloudflare";
import { addIpToListRules, zoneConfigs } from "~/db/schema/cloudflare";

type AddIpToListRule = typeof addIpToListRules.$inferSelect;
type Zone = typeof zoneConfigs.$inferSelect;

interface AddIpToListContext {
    zone: Zone;
    rule: AddIpToListRule;
    cf: CloudflareClient;
    logger: ActionLogger;
    cache: CacheStore;
    prefetchedIps?: { ip: string; count: number }[];
}

export async function runAddIpToListRule({
    zone,
    rule,
    cf,
    logger,
    cache,
    prefetchedIps,
}: AddIpToListContext): Promise<void> {
    const { cfListId, rateLimitThreshold, windowSeconds } = rule;

    debugLog(`  [add_ip_to_list] id=${rule.id} list=${cfListId} threshold=${rateLimitThreshold} window=${windowSeconds}s`);

    if (!cfListId || typeof rateLimitThreshold !== "number" || typeof windowSeconds !== "number") {
        console.error(`  Rule ${rule.id} has invalid configuration — skipping.`);
        return;
    }

    // ── 1. Resolve flagged IPs ─────────────────────────────────────────────
    let flaggedIPs: { ip: string; count: number }[] = [];

    if (prefetchedIps) {
        flaggedIPs = prefetchedIps.filter(({ count }) => count > rateLimitThreshold);
        debugLog(`  Using ${flaggedIPs.length} pre-fetched IPs for rule ${rule.id}.`);
    } else {
        try {
            const results = await cf.analytics.getTopStats({
                zoneTag: zone.cfZoneId,
                dimensions: ["clientIP"],
                windowSeconds,
                limit: 10000,
                latencyOffsetSeconds: 60,
            });
            flaggedIPs = results
                .filter((r: TopStatRow) => r.count > rateLimitThreshold)
                .map((r: TopStatRow) => ({ ip: String(r["clientIP"]), count: r.count }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  Failed to query IPs for rule ${rule.id}:`, msg);
            await logger.logActions([{
                userId: zone.userId,
                provider: "cloudflare",
                resourceId: zone.id,
                ruleId: rule.id,
                actionTaken: "IP_ADDED_TO_LIST_ERROR",
                targetType: "API_ERROR",
                targetValue: "Abusive IPs query failed",
                requestCount: null,
                metadata: JSON.stringify({ error: msg }),
                timestamp: new Date(),
            }]);
            return;
        }
    }

    if (flaggedIPs.length === 0) {
        debugLog(`  No IPs exceeded threshold for rule ${rule.id}.`);
        return;
    }

    // ── 2. Deduplicate against entity cache ───────────────────────────────
    const namespace = `cf_list:${cfListId}`;
    let cached = await cache.getAll(namespace);

    if (cached.size === 0) {
        debugLog(`  Cache miss for ${namespace}. Fetching live list from CF…`);
        try {
            const liveItems = await cf.lists.getItems(cfListId);
            const liveIps = liveItems.map((i: ListItem) => i.ip).filter((ip: string | undefined): ip is string => !!ip);
            await cache.sync(namespace, liveIps);
            cached = new Set(liveIps);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  Failed to fetch live list ${cfListId}:`, msg);
            await logger.logActions([{
                userId: zone.userId,
                provider: "cloudflare",
                resourceId: zone.id,
                ruleId: rule.id,
                actionTaken: "IP_ADDED_TO_LIST_ERROR",
                targetType: "API_ERROR",
                targetValue: msg.substring(0, 100),
                requestCount: null,
                metadata: JSON.stringify({ error: msg }),
                timestamp: new Date(),
            }]);
            return;
        }
    }

    const newItems = flaggedIPs.filter(({ ip }) => !cached.has(ip));
    if (newItems.length === 0) {
        debugLog(`  No new IPs to add for rule ${rule.id}.`);
        return;
    }

    debugLog(`  Adding ${newItems.length} new IP(s) to CF list…`);

    // ── 3. Batch POST to CF ───────────────────────────────────────────────
    const comment = `FlareStack auto-added ${new Date().toISOString()}`;
    const payload = newItems.map(({ ip }) => ({ ip, comment }));

    let operationId: string | null = null;
    try {
        operationId = await cf.lists.addItems(cfListId, payload);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  CF list add failed for rule ${rule.id}:`, msg);
        await logger.logActions([{
            userId: zone.userId,
            provider: "cloudflare",
            resourceId: zone.id,
            ruleId: rule.id,
            actionTaken: "IP_ADDED_TO_LIST_ERROR",
            targetType: "API_ERROR",
            targetValue: "List update failed",
            requestCount: newItems.length,
            metadata: JSON.stringify({ error: msg }),
            timestamp: new Date(),
        }]);
        // Re-sync cache after failure
        try {
            const liveItems = await cf.lists.getItems(cfListId);
            await cache.sync(namespace, liveItems.map((i: ListItem) => i.ip).filter((ip: string | undefined): ip is string => !!ip));
        } catch { /* ignore sync errors */ }
        return;
    }

    // ── 4. Update cache + audit log ───────────────────────────────────────
    await cache.add(namespace, newItems.map((i) => i.ip));
    await logger.logActions(newItems.map(({ ip, count }) => ({
        userId: zone.userId,
        provider: "cloudflare",
        resourceId: zone.id,
        ruleId: rule.id,
        actionTaken: "IP_ADDED_TO_LIST",
        targetType: "IP",
        targetValue: ip,
        requestCount: count,
        metadata: JSON.stringify({ cfListId, cfOperationId: operationId }),
        timestamp: new Date(),
    })));

    debugLog(`  Done. Added ${newItems.length} IP(s). CF operation: ${operationId}`);
}
