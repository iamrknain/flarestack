"use server";

import { debugLog } from "~/lib/debug";
import { sendEmail } from "~/lib/email";
import { ActionLogger } from "~/lib/logger";
import { wafRuleOnEmail, wafRuleOffEmail, wafRuleNotFoundEmail } from "./emails";
import { CloudflareClient } from "~/lib/cloudflare";
import { wafRules, zoneConfigs } from "~/db/schema/cloudflare";
import { getDb } from "~/db";
import { eq } from "drizzle-orm";

type WafRule = typeof wafRules.$inferSelect;
type Zone = typeof zoneConfigs.$inferSelect;

interface WafContext {
    zone: Zone;
    rule: WafRule;
    cf: CloudflareClient;
    logger: ActionLogger;
}

export async function runWafAutomationRule({ zone, rule, cf, logger }: WafContext): Promise<void> {
    const {
        id,
        name,
        cfRulesetId,
        cfRuleId,
        cfRuleName,
        rateLimitThreshold,
        windowSeconds,
        autoOff,
        offThreshold,
        sendNotification,
        notifyEmails,
    } = rule;

    debugLog(`  [waf_rule] id=${id} name="${name}" threshold=${rateLimitThreshold} autoOff=${autoOff}`);

    if (typeof rateLimitThreshold !== "number" || typeof windowSeconds !== "number") {
        console.error(`  Rule ${id} has invalid configuration — skipping.`);
        return;
    }

    // ── 1. Fetch Cloudflare Rule Status (Check if exists & get enabled state) ──
    let isRuleEnabled = false;
    let ruleExists = false;
    try {
        const ruleset = await cf.rulesets.getRuleset(zone.cfZoneId, cfRulesetId);
        const existingRule = ruleset.rules?.find((r) => r.id === cfRuleId);
        if (existingRule) {
            ruleExists = true;
            isRuleEnabled = existingRule.enabled;
            debugLog(`  Found target rule on CF. Currently enabled: ${isRuleEnabled}`);
        }
    } catch (err: any) {
        // If 404 ruleset/rule not found or auth error, handle it
        debugLog(`  Failed to fetch WAF rule from Cloudflare: ${err.message || err}`);
    }

    // ── 2. Handle deleted rule on Cloudflare (Self-Healing) ─────────────────
    if (!ruleExists) {
        console.warn(`  Target rule ${cfRuleId} not found on Cloudflare. Auto-disabling automation rule ${id}.`);
        
        try {
            const db = getDb();
            // Disable the rule locally
            await db
                .update(wafRules)
                .set({ isActive: false, updatedAt: new Date() })
                .where(eq(wafRules.id, id));

            // Log action in FlareStack
            await logger.logActions([{
                userId: zone.userId,
                provider: "cloudflare",
                resourceId: zone.id,
                ruleId: id,
                actionTaken: "WAF_RULE_NOT_FOUND",
                targetType: "API_ERROR",
                targetValue: cfRuleName.substring(0, 100),
                requestCount: null,
                metadata: JSON.stringify({ error: "Target WAF Rule not found on Cloudflare ruleset. Auto-disabled local rule." }),
                timestamp: new Date(),
            }]);

            // Email Notification if enabled
            if (sendNotification && notifyEmails) {
                await sendEmail({
                    to: notifyEmails.split(",").map((e) => e.trim()),
                    subject: `[Alert] WAF Automation Rule Auto-Disabled: ${name}`,
                    html: wafRuleNotFoundEmail(zone.name, zone.domain, zone.cfZoneId, name, cfRuleName),
                });
            }
        } catch (dbErr) {
            console.error(`  Failed to auto-disable rule ${id} in database:`, dbErr);
        }
        return;
    }

    // ── 3. Get zone-wide total traffic ────────────────────────────────────
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
        console.error(`  Traffic query failed for rule ${id}:`, msg);
        await logger.logActions([{
            userId: zone.userId,
            provider: "cloudflare",
            resourceId: zone.id,
            ruleId: id,
            actionTaken: "WAF_RULE_ERROR",
            targetType: "API_ERROR",
            targetValue: "Traffic query failed",
            requestCount: null,
            metadata: JSON.stringify({ error: msg }),
            timestamp: new Date(),
        }]);
        return;
    }

    // ── 4. Apply threshold logic ──────────────────────────────────────────
    if (totalRequests > rateLimitThreshold) {
        if (!isRuleEnabled) {
            try {
                // Enable the WAF rule
                await cf.rulesets.updateRule(zone.cfZoneId, cfRulesetId, cfRuleId, { enabled: true });
                
                await logger.logActions([{
                    userId: zone.userId,
                    provider: "cloudflare",
                    resourceId: zone.id,
                    ruleId: id,
                    actionTaken: "WAF_RULE_ON",
                    targetType: "WAF",
                    targetValue: cfRuleName,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ rateLimitThreshold, totalRequests, windowSeconds }),
                    timestamp: new Date(),
                }]);
                debugLog(`  Enabled WAF custom rule "${cfRuleName}" for ${zone.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e) => e.trim()),
                        subject: `[Alert] WAF Custom Rule ACTIVATED for ${zone.name}`,
                        html: wafRuleOnEmail(zone.name, zone.domain, zone.cfZoneId, name, cfRuleName, totalRequests, rateLimitThreshold, windowSeconds),
                    });
                }
            } catch (err: any) {
                console.error(`  Failed to enable WAF custom rule for ${zone.name}:`, err.message || err);
                await logger.logActions([{
                    userId: zone.userId,
                    provider: "cloudflare",
                    resourceId: zone.id,
                    ruleId: id,
                    actionTaken: "WAF_RULE_ERROR",
                    targetType: "API_ERROR",
                    targetValue: "Activation failed",
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ error: err.message || err }),
                    timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  WAF Custom Rule already enabled.`);
        }
    } else if (autoOff && typeof offThreshold === "number" && totalRequests < offThreshold) {
        if (isRuleEnabled) {
            try {
                // Disable the WAF rule
                await cf.rulesets.updateRule(zone.cfZoneId, cfRulesetId, cfRuleId, { enabled: false });

                await logger.logActions([{
                    userId: zone.userId,
                    provider: "cloudflare",
                    resourceId: zone.id,
                    ruleId: id,
                    actionTaken: "WAF_RULE_OFF",
                    targetType: "WAF",
                    targetValue: cfRuleName,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ offThreshold, totalRequests, windowSeconds }),
                    timestamp: new Date(),
                }]);
                debugLog(`  Disabled WAF custom rule "${cfRuleName}" for ${zone.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e) => e.trim()),
                        subject: `[Resolve] WAF Custom Rule DEACTIVATED for ${zone.name}`,
                        html: wafRuleOffEmail(zone.name, zone.domain, zone.cfZoneId, name, cfRuleName, totalRequests, offThreshold, windowSeconds),
                    });
                }
            } catch (err: any) {
                console.error(`  Failed to disable WAF custom rule for ${zone.name}:`, err.message || err);
                await logger.logActions([{
                    userId: zone.userId,
                    provider: "cloudflare",
                    resourceId: zone.id,
                    ruleId: id,
                    actionTaken: "WAF_RULE_ERROR",
                    targetType: "API_ERROR",
                    targetValue: "Deactivation failed",
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ error: err.message || err }),
                    timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Traffic normal, WAF rule is already disabled.`);
        }
    } else {
        debugLog(`  Traffic (${totalRequests}) in hysteresis zone. No change.`);
    }
}
