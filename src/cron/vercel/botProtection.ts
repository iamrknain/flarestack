"use server";

import { getDb } from "~/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { vercelTrafficStats, vercelBotProtectionRules, vercelProjects } from "~/db/schema/vercel";
import { zoneConfigs, cloudflareAccounts } from "~/db/schema/cloudflare";
import { actionLogs } from "~/db/schema/general";
import { debugLog } from "~/lib/debug";
import { sendEmail } from "~/lib/email";
import { ActionLogger } from "~/lib/logger";
import { vercelBotProtectionOnEmail, vercelBotProtectionOffEmail } from "./emails";
import type { VercelProjectWithCredentials } from "./underAttackMode";
import { VercelClient } from "~/lib/vercel";
import { CloudflareClient } from "~/lib/cloudflare";

export type VercelBotProtectionRule = typeof vercelBotProtectionRules.$inferSelect;

interface Ctx {
    project: VercelProjectWithCredentials;
    rule: VercelBotProtectionRule;
    logger: ActionLogger;
}

export async function runVercelBotProtectionRule({ project, rule, logger }: Ctx): Promise<void> {
    const db = getDb();
    const { rateLimitThreshold, autoOff, offThreshold, windowSeconds, action = "challenge", sendNotification, notifyEmails } = rule;
    const windowSecs = windowSeconds ?? 300;

    // 1. Resolve traffic
    const cutoff = Math.floor(Date.now() / 1000) - windowSecs;
    let totalRequests = 0;

    if (rule.trafficSource === "cloudflare" && rule.cfZoneConfigRef) {
        const [zoneConfig] = await db
            .select()
            .from(zoneConfigs)
            .where(eq(zoneConfigs.id, rule.cfZoneConfigRef));
        if (zoneConfig) {
            const [cfAccount] = await db
                .select()
                .from(cloudflareAccounts)
                .where(eq(cloudflareAccounts.id, zoneConfig.cfAccountRef));
            if (cfAccount) {
                const cf = new CloudflareClient(cfAccount.cfAccountId, cfAccount.cfApiToken);
                try {
                    const results = await cf.analytics.getTopStats({
                        zoneTag: zoneConfig.cfZoneId,
                        dimensions: [],
                        windowSeconds: windowSecs,
                        limit: 1,
                    });
                    if (results.length > 0) totalRequests = results[0].count;
                } catch (err) {
                    console.error(`  CF traffic query failed for Vercel rule ${rule.id}:`, err);
                }
            }
        }
    } else {
        const stats = await db
            .select({ count: sql<number>`sum(${vercelTrafficStats.requestCount})` })
            .from(vercelTrafficStats)
            .where(and(eq(vercelTrafficStats.projectId, project.vercelProjectId), gte(vercelTrafficStats.minute, cutoff)));

        totalRequests = Number(stats[0]?.count || 0);
    }
    debugLog(`  Vercel traffic (${rule.trafficSource || "vercel_drain"}): ${totalRequests} reqs in last ${windowSecs}s.`);

    // 2. Fetch current firewall config from Vercel
    const client = new VercelClient(project.vercelToken, project.vercelTeamId);

    let currentConfig: any = null;
    let isBotProtectionActive = false;
    let currentAction = "challenge";
    try {
        currentConfig = await client.firewall.getConfig(project.vercelProjectId);
        isBotProtectionActive = !!currentConfig.managedRules?.bot_protection?.active;
        currentAction = currentConfig.managedRules?.bot_protection?.action || "challenge";
        debugLog(`  Bot Protection: ${isBotProtectionActive ? "ACTIVE" : "INACTIVE"} (action: "${currentAction}")`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Failed to fetch firewall config for ${project.name}:`, msg);
        await logger.logActions([{
            userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
            actionTaken: "VERCEL_BOT_PROTECTION_ERROR", targetType: "API_ERROR",
            targetValue: msg.substring(0, 100), requestCount: null,
            metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
        }]);
        return;
    }

    // Helper to PUT updated config
    const updateFirewall = async (activate: boolean) => {
        const cleaned = {
            crs: currentConfig.crs,
            managedRules: { ...currentConfig.managedRules, bot_protection: { active: activate, action } },
            firewallEnabled: currentConfig.firewallEnabled !== false,
            rules: (currentConfig.rules || []).map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }: any) => rest),
        };
        await client.firewall.updateConfig(project.vercelProjectId, cleaned);
    };

    // 3. Threshold logic
    if (totalRequests > rateLimitThreshold) {
        if (!isBotProtectionActive || currentAction !== action) {
            // Check if we recently triggered VERCEL_BOT_PROTECTION_ON to avoid duplicate triggers
            const lastOnLog = await db
                .select()
                .from(actionLogs)
                .where(
                    and(
                        eq(actionLogs.ruleId, rule.id),
                        eq(actionLogs.actionTaken, "VERCEL_BOT_PROTECTION_ON")
                    )
                )
                .orderBy(desc(actionLogs.timestamp))
                .limit(1);

            if (lastOnLog.length > 0) {
                const elapsedMs = Date.now() - new Date(lastOnLog[0].timestamp).getTime();
                const cooldownMs = windowSecs * 1000;
                if (elapsedMs < cooldownMs) {
                    debugLog(`  Vercel Bot Protection activation is on cooldown (last attempted ${Math.round(elapsedMs / 1000)}s ago, window is ${windowSecs}s). Skipping duplicate trigger.`);
                    return;
                }
            }

            try {
                await updateFirewall(true);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_BOT_PROTECTION_ON", targetType: "PROJECT", targetValue: project.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ rateLimitThreshold, totalRequests, action }), timestamp: new Date(),
                }]);
                debugLog(`  Enabled Vercel Bot Protection for ${project.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e: string) => e.trim()),
                        subject: `[Alert] Vercel Bot Protection ACTIVATED for ${project.domain || project.name}`,
                        html: vercelBotProtectionOnEmail(project.name, project.domain, totalRequests, rateLimitThreshold, action, windowSecs),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to enable Vercel Bot Protection:`, msg);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_BOT_PROTECTION_ERROR", targetType: "API_ERROR",
                    targetValue: "Activation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Bot Protection already active with action "${action}".`);
        }
    } else if (autoOff && typeof offThreshold === "number" && totalRequests < offThreshold) {
        if (isBotProtectionActive) {
            try {
                await updateFirewall(false);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_BOT_PROTECTION_OFF", targetType: "PROJECT", targetValue: project.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ offThreshold, totalRequests }), timestamp: new Date(),
                }]);
                debugLog(`  Disabled Vercel Bot Protection for ${project.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e: string) => e.trim()),
                        subject: `[Resolve] Vercel Bot Protection DEACTIVATED for ${project.domain || project.name}`,
                        html: vercelBotProtectionOffEmail(project.name, project.domain, totalRequests, offThreshold, windowSecs),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to disable Vercel Bot Protection:`, msg);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_BOT_PROTECTION_ERROR", targetType: "API_ERROR",
                    targetValue: "Deactivation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Bot Protection already inactive.`);
        }
    } else {
        debugLog(`  Traffic (${totalRequests}) in neutral range. No action.`);
    }
}
