import { getWorkerDb } from './lib/db';
import { zoneConfigs, cloudflareAccounts } from '@flarestack/db/src/schema/zones';
import { vercelAccounts, vercelProjects, vercelUnderAttackRules, vercelBotProtectionRules } from '@flarestack/db/src/schema/vercel';
import { eq, inArray, and } from 'drizzle-orm';
import { RULES_MANIFEST } from '@flarestack/rules';
import { Env } from './index';
import { RuleEngine } from './engine';
import { ActionLogger } from './lib/actions/logger';
import { CacheStore } from '@flarestack/db/src/cache';
import { CloudflareClient } from '@flarestack/cloudflare';
import { VercelRuleHandlers } from './rules/index';
import { initLogger, log } from './lib/log';

// ─── Main cron handler ───────────────────────────────────────────────────────
export async function runCronTasks(env: Env): Promise<void> {
    initLogger(env.DEBUG === 'true');
    log('--- FlareStack Execution Loop ---');
    const db = getWorkerDb(env);

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
    const ruleTables = Object.values(RULES_MANIFEST).filter(
        m => m.table && !m.type.startsWith('vercel_')
    );

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

    // ── 6. Load all active Vercel projects ────────────────────────────────────
    const activeVercelProjects = await db
        .select()
        .from(vercelProjects)
        .where(eq(vercelProjects.isActive, true))
        .all();

    if (activeVercelProjects.length > 0) {
        log(`\nFound ${activeVercelProjects.length} active Vercel project(s).`);

        // Load all active Vercel accounts to resolve credentials
        const uniqueVercelAccountRefs = [...new Set(activeVercelProjects.map(p => p.vercelAccountRef))];
        const vercelAccountRows = uniqueVercelAccountRefs.length > 0
            ? await db
                .select()
                .from(vercelAccounts)
                .where(inArray(vercelAccounts.id, uniqueVercelAccountRefs))
                .all()
            : [];

        const vercelAccountMap = new Map(vercelAccountRows.map(a => [a.id, a]));

        // Load active rules for these projects
        const vercelUnderAttackRulesList = await db
            .select()
            .from(vercelUnderAttackRules)
            .where(eq(vercelUnderAttackRules.isActive, true))
            .all();

        const vercelBotProtectionRulesList = await db
            .select()
            .from(vercelBotProtectionRules)
            .where(eq(vercelBotProtectionRules.isActive, true))
            .all();

        const minutesSinceEpoch = Math.floor(Date.now() / (60 * 1000));

        // Group rules by project id
        const underAttackRulesMap = new Map<string, typeof vercelUnderAttackRulesList>();
        const botRulesMap = new Map<string, typeof vercelBotProtectionRulesList>();

        for (const rule of vercelUnderAttackRulesList) {
            const list = underAttackRulesMap.get(rule.vercelProjectRef) || [];
            list.push(rule);
            underAttackRulesMap.set(rule.vercelProjectRef, list);
        }
        for (const rule of vercelBotProtectionRulesList) {
            const list = botRulesMap.get(rule.vercelProjectRef) || [];
            list.push(rule);
            botRulesMap.set(rule.vercelProjectRef, list);
        }

        for (const project of activeVercelProjects) {
            const vercelAccount = vercelAccountMap.get(project.vercelAccountRef);
            if (!vercelAccount) {
                console.error(`Vercel project: no Vercel account found for ref "${project.vercelAccountRef}" — skipping.`);
                continue;
            }

            const projectWithCredentials = {
                ...project,
                vercelToken: vercelAccount.vercelToken,
                vercelTeamId: vercelAccount.vercelTeamId
            };

            log(`\nProcessing Vercel project: ${projectWithCredentials.name} (${projectWithCredentials.vercelProjectId})`);

            const underAttackRules = underAttackRulesMap.get(projectWithCredentials.id) || [];
            const botRules = botRulesMap.get(projectWithCredentials.id) || [];

            // Process under attack rules
            for (const rule of underAttackRules) {
                const windowSeconds = rule.windowSeconds ?? 300;
                const intervalMins = Math.max(1, Math.floor(windowSeconds / 60));
                const currentSlot = minutesSinceEpoch % intervalMins;
                const isDue = currentSlot === 0 || currentSlot === intervalMins - 1;

                if (!isDue) continue;

                log(`  Executing rule ${rule.id} (type=vercel_under_attack_mode)`);
                const handler = VercelRuleHandlers['vercel_under_attack_mode'];
                try {
                    await handler.execute({ project: projectWithCredentials, rule, actionLogger, env });
                } catch (err) {
                    console.error(`  Error running Vercel under attack rule ${rule.id}:`, err);
                }
            }

            // Process bot protection rules
            for (const rule of botRules) {
                const windowSeconds = rule.windowSeconds ?? 300;
                const intervalMins = Math.max(1, Math.floor(windowSeconds / 60));
                const currentSlot = minutesSinceEpoch % intervalMins;
                const isDue = currentSlot === 0 || currentSlot === intervalMins - 1;

                if (!isDue) continue;

                log(`  Executing rule ${rule.id} (type=vercel_bot_protection)`);
                const handler = VercelRuleHandlers['vercel_bot_protection'];
                try {
                    await handler.execute({ project: projectWithCredentials, rule, actionLogger, env });
                } catch (err) {
                    console.error(`  Error running Vercel bot protection rule ${rule.id}:`, err);
                }
            }
        }
    }

    log('\n--- FlareStack Execution Loop Complete ---');
}
