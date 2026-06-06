"use server";

import { debugLog } from "~/lib/debug";
import { sendEmail } from "~/lib/email";
import { ActivityLogger } from "~/lib/logger";
import { underAttackOnEmail, underAttackOffEmail } from "./emails";
import { CloudflareClient } from "~/lib/cloudflare";
import { underAttackRules, zoneConfigs } from "~/db/schema/cloudflare";

type UnderAttackRule = typeof underAttackRules.$inferSelect;
type Zone = typeof zoneConfigs.$inferSelect;

interface UnderAttackContext {
    zone: Zone;
    rule: UnderAttackRule;
    cf: CloudflareClient;
    logger: ActivityLogger;
}

export async function runUnderAttackModeRule({ zone, rule, cf, logger }: UnderAttackContext): Promise<void> {
    const {
        rateLimitThreshold,
        autoOff,
        offThreshold,
        windowSeconds,
        recoveryLevel,
        sendNotification,
        notifyEmails,
    } = rule;

    debugLog(`  [under_attack_mode] id=${rule.id} threshold=${rateLimitThreshold} autoOff=${autoOff}`);

    if (typeof rateLimitThreshold !== "number" || typeof windowSeconds !== "number") {
        console.error(`  Rule ${rule.id} has invalid configuration — skipping.`);
        return;
    }

    // ── 1. Get zone-wide total traffic ────────────────────────────────────
    let totalRequests = 0;
    try {
        const results = await cf.analytics.getTopStats({
            zoneTag: zone.cfZoneId,
            dimensions: [],
            windowSeconds,
            limit: 1,
        });
        if (results.length > 0) totalRequests = results[0].count;
        debugLog(`  Zone traffic: ${totalRequests} reqs in last ${windowSeconds}s.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Traffic query failed for rule ${rule.id}:`, msg);
        await logger.logActions([{
            userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
            actionTaken: "UNDER_ATTACK_MODE_ERROR", targetType: "API_ERROR",
            targetValue: "Traffic query failed", requestCount: null,
            metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
        }]);
        return;
    }

    // ── 2. Get current CF security level ─────────────────────────────────
    let currentLevel: string;
    try {
        currentLevel = await cf.zones.getSecurityLevel(zone.cfZoneId);
        debugLog(`  Current security level: "${currentLevel}".`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Security level query failed for rule ${rule.id}:`, msg);
        await logger.logActions([{
            userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
            actionTaken: "UNDER_ATTACK_MODE_ERROR", targetType: "API_ERROR",
            targetValue: msg.substring(0, 100), requestCount: null,
            metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
        }]);
        return;
    }

    // ── 3. Apply threshold logic ──────────────────────────────────────────
    if (totalRequests > rateLimitThreshold) {
        if (currentLevel !== "under_attack") {
            try {
                await cf.zones.setSecurityLevel(zone.cfZoneId, "under_attack");
                await logger.logActions([{
                    userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
                    actionTaken: "UNDER_ATTACK_MODE_ON", targetType: "ZONE", targetValue: zone.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ previousLevel: currentLevel, rateLimitThreshold, totalRequests }),
                    timestamp: new Date(),
                }]);
                debugLog(`  Enabled Under Attack Mode for ${zone.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e) => e.trim()),
                        subject: `[Alert] Under Attack Mode ACTIVATED for ${zone.name}`,
                        html: underAttackOnEmail(zone.name, zone.domain, zone.cfZoneId, totalRequests, rateLimitThreshold, windowSeconds),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to enable Under Attack Mode for ${zone.name}:`, msg);
                await logger.logActions([{
                    userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
                    actionTaken: "UNDER_ATTACK_MODE_ERROR", targetType: "API_ERROR",
                    targetValue: "Activation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Already in under_attack mode.`);
        }
    } else if (autoOff && typeof offThreshold === "number" && totalRequests < offThreshold) {
        if (currentLevel === "under_attack") {
            const targetLevel = (recoveryLevel || "medium") as string;
            try {
                await cf.zones.setSecurityLevel(zone.cfZoneId, targetLevel as any);
                await logger.logActions([{
                    userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
                    actionTaken: "UNDER_ATTACK_MODE_OFF", targetType: "ZONE", targetValue: zone.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ restoredLevel: targetLevel, offThreshold, totalRequests }),
                    timestamp: new Date(),
                }]);
                debugLog(`  Restored security level to "${targetLevel}" for ${zone.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e) => e.trim()),
                        subject: `[Resolve] Under Attack Mode DEACTIVATED for ${zone.name}`,
                        html: underAttackOffEmail(zone.name, zone.domain, zone.cfZoneId, totalRequests, offThreshold, targetLevel, windowSeconds),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to restore security level for ${zone.name}:`, msg);
                await logger.logActions([{
                    userId: zone.userId, provider: "cloudflare", resourceId: zone.id, ruleId: rule.id,
                    actionTaken: "UNDER_ATTACK_MODE_ERROR", targetType: "API_ERROR",
                    targetValue: "Deactivation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Traffic normal, security level is already "${currentLevel}".`);
        }
    } else {
        debugLog(`  Traffic (${totalRequests}) in hysteresis zone. No change.`);
    }
}


