"use server";

import { getDb } from "~/db";
import { zoneConfigs, cloudflareAccounts, addIpToListRules, underAttackRules, wafRules } from "~/db/schema/cloudflare";
import { eq, and, inArray } from "drizzle-orm";
import { CloudflareClient } from "~/lib/cloudflare";
import { ActivityLogger } from "~/lib/logger";
import { runAddIpToListRule } from "./addIpToList";
import { runUnderAttackModeRule } from "./underAttackMode";
import { runWafAutomationRule } from "./wafRules";

export async function runCloudflareCron(userId: string): Promise<void> {
    const db = getDb();
    const logger = new ActivityLogger(db);

    // 1. Load all active zones for this user
    const zones = await db
        .select()
        .from(zoneConfigs)
        .where(and(eq(zoneConfigs.userId, userId), eq(zoneConfigs.isActive, true)));

    if (zones.length === 0) {
        console.log("[cron/cloudflare] No active zones found.");
        return;
    }

    // 2. Load CF accounts in one query
    const accountRefs = [...new Set(zones.map((z) => z.cfAccountRef))];
    const accounts = await db
        .select()
        .from(cloudflareAccounts)
        .where(inArray(cloudflareAccounts.id, accountRefs));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const zoneIds = zones.map((z) => z.id);

    // 3. Load all active rules in one batch
    const [ipRules, attackRules, activeWafRules] = await Promise.all([
        db.select().from(addIpToListRules)
            .where(and(inArray(addIpToListRules.zoneConfigId, zoneIds), eq(addIpToListRules.isActive, true))),
        db.select().from(underAttackRules)
            .where(and(inArray(underAttackRules.zoneConfigId, zoneIds), eq(underAttackRules.isActive, true))),
        db.select().from(wafRules)
            .where(and(inArray(wafRules.zoneConfigId, zoneIds), eq(wafRules.isActive, true))),
    ]);

    const minutesSinceEpoch = Math.floor(Date.now() / (60 * 1000));

    // 4. Process all zones concurrently
    await Promise.allSettled(
        zones.map(async (zone) => {
            const account = accountMap.get(zone.cfAccountRef);
            if (!account) {
                console.error(`[cron/cloudflare] No account found for zone ${zone.name}`);
                return;
            }
            const cf = new CloudflareClient(account.cfAccountId, account.cfApiToken);

            const zoneIpRules = ipRules.filter((r) => r.zoneConfigId === zone.id);
            const zoneAttackRules = attackRules.filter((r) => r.zoneConfigId === zone.id);
            const zoneWafRules = activeWafRules.filter((r) => r.zoneConfigId === zone.id);

            // Execute ip rules
            for (const rule of zoneIpRules) {
                if (!isDue(rule.windowSeconds ?? 300, minutesSinceEpoch)) continue;
                try {
                    const ruleCf = rule.cfApiTokenOverride && rule.cfApiTokenOverride.trim().length > 0
                        ? new CloudflareClient(account.cfAccountId, rule.cfApiTokenOverride.trim())
                        : cf;
                    await runAddIpToListRule({ zone, rule, cf: ruleCf, logger, db });
                } catch (err) {
                    console.error(`[cron/cloudflare] Rule ${rule.id} failed:`, err);
                }
            }

            // Execute under attack rules
            for (const rule of zoneAttackRules) {
                if (!isDue(rule.windowSeconds ?? 300, minutesSinceEpoch)) continue;
                try {
                    const ruleCf = rule.cfApiTokenOverride && rule.cfApiTokenOverride.trim().length > 0
                        ? new CloudflareClient(account.cfAccountId, rule.cfApiTokenOverride.trim())
                        : cf;
                    await runUnderAttackModeRule({ zone, rule, cf: ruleCf, logger });
                } catch (err) {
                    console.error(`[cron/cloudflare] Rule ${rule.id} failed:`, err);
                }
            }

            // Execute WAF rules
            for (const rule of zoneWafRules) {
                if (!isDue(rule.windowSeconds ?? 300, minutesSinceEpoch)) continue;
                try {
                    const ruleCf = rule.cfApiTokenOverride && rule.cfApiTokenOverride.trim().length > 0
                        ? new CloudflareClient(account.cfAccountId, rule.cfApiTokenOverride.trim())
                        : cf;
                    await runWafAutomationRule({ zone, rule, cf: ruleCf, logger });
                } catch (err) {
                    console.error(`[cron/cloudflare] WAF Rule ${rule.id} failed:`, err);
                }
            }
        })
    );

    console.log(`[cron/cloudflare] Done. Processed ${zones.length} zone(s).`);
}

function isDue(windowSeconds: number, minutesSinceEpoch: number): boolean {
    const interval = Math.max(1, Math.floor(windowSeconds / 60));
    return (minutesSinceEpoch % interval) === 0;
}
