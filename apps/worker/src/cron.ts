import { drizzle } from 'drizzle-orm/d1';
import { zoneConfigs, cloudflareAccounts } from '@flarestack/db/src/schema/zones';
import { eq, inArray, and } from 'drizzle-orm';
import { RULES_MANIFEST } from '@flarestack/rules';
import { Env } from './index';
import { RuleEngine } from './engine';
import { ActionLogger } from './lib/actions/logger';
import { CacheStore } from '@flarestack/db/src/cache';
import { CloudflareClient } from '@flarestack/cloudflare';
import { initLogger, log } from './lib/log';

// ─── Main cron handler ───────────────────────────────────────────────────────
export async function runCronTasks(env: Env): Promise<void> {
    initLogger(env.DEBUG === 'true');
    log('--- FlareStack Execution Loop ---');
    const db = drizzle(env.DB);

    // ── 1. Load all active zones ─────────────────────────────────────────────
    const activeZones = await db
        .select()
        .from(zoneConfigs)
        .where(eq(zoneConfigs.isActive, true))
        .all();

    if (activeZones.length === 0) {
        log('No active zones configured. Sleeping.');
        return;
    }

    log(`Found ${activeZones.length} active zone(s).`);

    // ── 2. Preload ALL CF accounts in a single D1 query ──────────────────────
    const uniqueAccountRefs = [...new Set(activeZones.map(z => z.cfAccountRef))];
    const accountRows = await db
        .select()
        .from(cloudflareAccounts)
        .where(inArray(cloudflareAccounts.id, uniqueAccountRefs))
        .all();

    const accountMap = new Map(accountRows.map(a => [a.id, a]));

    // ── 3. Mega-batch: load ALL rules for ALL zones in ONE db.batch() ────────
    //    Build one query per (zone × ruleTable) pair, fire them all at once.
    const ruleTables = Object.values(RULES_MANIFEST).filter(m => m.table);

    const batchQueries: any[] = [];
    const queryIndex: { zoneId: string; ruleType: string }[] = [];

    for (const zone of activeZones) {
        for (const t of ruleTables) {
            batchQueries.push(
                db.select().from(t.table!).where(
                    and(eq(t.table!.zoneConfigId, zone.id), eq(t.table!.isActive, true))
                )
            );
            queryIndex.push({ zoneId: zone.id, ruleType: t.type });
        }
    }

    // Single D1 HTTP round-trip for ALL rule queries.
    const batchResults: any[][] = batchQueries.length > 0
        ? await (db as any).batch(batchQueries)
        : [];

    // Reshape into Map<zoneId, rule[]>.
    const rulesByZone = new Map<string, any[]>();
    batchResults.forEach((rows, i) => {
        const { zoneId, ruleType } = queryIndex[i];
        const existing = rulesByZone.get(zoneId) ?? [];
        const typed = rows.map((r: any) => ({ ...r, type: ruleType }));
        rulesByZone.set(zoneId, [...existing, ...typed]);
    });

    // ── 4. Cross-zone GraphQL batching ───────────────────────────────────────
    //    Group zones by CF account, then fire ONE batched analytics query per
    //    account. This collapses N per-zone HTTP requests into 1 per account.
    const zonesByAccount = new Map<string, typeof activeZones>();
    for (const zone of activeZones) {
        const key = zone.cfAccountRef;
        const list = zonesByAccount.get(key) ?? [];
        list.push(zone);
        zonesByAccount.set(key, list);
    }

    // For each account group, build a CloudflareClient and call
    // getTopIpStatsBatch() with ALL zones in that group.
    // We need per-rule thresholds — so we pick the most common windowSeconds
    // from the rules. In practice, most zones share the same window.
    const prefetchedIpsByZone = new Map<string, { ip: string; count: number }[]>();

    // Build tagged promises so error reporting doesn't rely on fragile
    // index-based key recreation.
    const accountEntries = [...zonesByAccount.entries()];
    const analyticsSettled = await Promise.allSettled(
        accountEntries.map(async ([accountRef, zones]) => {
            const account = accountMap.get(accountRef);
            if (!account) {
                console.error(`Analytics batch: no CF account found for ref "${accountRef}" — skipping its zones.`);
                return;
            }

            const cf = new CloudflareClient(account.cfAccountId, account.cfApiToken);

            // Collect analytics params per zone.
            // Use the LOWEST threshold and LARGEST window across all rules
            // for that zone to cast the widest net; per-rule filtering happens
            // inside the handler itself via the pre-fetched data.
            const analyticsParams: { cfZoneId: string; threshold: number; windowSeconds: number }[] = [];

            for (const zone of zones) {
                const rules = rulesByZone.get(zone.id) ?? [];
                if (rules.length === 0) continue;

                // Find the most permissive params across all rules for this zone.
                let lowestThreshold = Infinity;
                let largestWindow = 0;
                for (const rule of rules) {
                    if (typeof rule.rateLimitThreshold === 'number') {
                        lowestThreshold = Math.min(lowestThreshold, rule.rateLimitThreshold);
                    }
                    if (typeof rule.windowSeconds === 'number') {
                        largestWindow = Math.max(largestWindow, rule.windowSeconds);
                    }
                }

                if (lowestThreshold < Infinity && largestWindow > 0) {
                    analyticsParams.push({
                        cfZoneId: zone.cfZoneId,
                        threshold: lowestThreshold,
                        windowSeconds: largestWindow,
                    });
                }
            }

            if (analyticsParams.length === 0) return;

            log(`  Batched analytics for ${analyticsParams.length} zone(s) on account ${account.label}`);

            const batchResults = await cf.analytics.getTopStatsBatch(
                analyticsParams.map(p => ({
                    zoneTag: p.cfZoneId,
                    dimensions: ['clientIP'],
                    windowSeconds: p.windowSeconds,
                    limit: 10000,
                    latencyOffsetSeconds: 60,
                }))
            );

            // Apply per-zone thresholds and reshape to { ip, count }[].
            for (const p of analyticsParams) {
                const raw = batchResults.get(p.cfZoneId) ?? [];
                prefetchedIpsByZone.set(
                    p.cfZoneId,
                    raw
                        .filter(r => r.count > p.threshold)
                        .map(r => ({ ip: String(r['clientIP']), count: r.count as number }))
                );
            }
        })
    );

    // Surface any analytics errors.
    analyticsSettled.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.error(`Analytics batch for account "${accountEntries[i][0]}" failed:`, result.reason);
        }
    });

    // ── 5. Create engine and process all zones concurrently ───────────────────
    const actionLogger = new ActionLogger(db);
    const cacheStore = new CacheStore(db);
    const engine = new RuleEngine(accountMap, actionLogger, cacheStore, env);

    const results = await Promise.allSettled(
        activeZones.map(zone =>
            engine.processZone(
                zone,
                rulesByZone.get(zone.id) ?? [],
                prefetchedIpsByZone
            )
        )
    );

    // Surface per-zone errors.
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.error(
                `Zone "${activeZones[i].name}" (${activeZones[i].cfZoneId}) threw an unhandled error:`,
                result.reason
            );
        }
    });

    log('\n--- FlareStack Execution Loop Complete ---');
}
