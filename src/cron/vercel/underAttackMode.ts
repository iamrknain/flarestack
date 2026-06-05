"use server";

import { getDb } from "~/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { vercelTrafficStats, vercelUnderAttackRules, vercelProjects, vercelAccounts } from "~/db/schema/vercel";
import { zoneConfigs, cloudflareAccounts } from "~/db/schema/cloudflare";
import { actionLogs } from "~/db/schema/general";
import { debugLog } from "~/lib/debug";
import { sendEmail } from "~/lib/email";
import { ActionLogger } from "~/lib/logger";
import { vercelAttackOnEmail, vercelAttackOffEmail } from "./emails";
import { VercelClient } from "~/lib/vercel";
import { CloudflareClient } from "~/lib/cloudflare";

export type VercelUnderAttackRule = typeof vercelUnderAttackRules.$inferSelect;
export type VercelProject = typeof vercelProjects.$inferSelect;
export type VercelAccount = typeof vercelAccounts.$inferSelect;

export interface VercelProjectWithCredentials extends VercelProject {
    vercelToken: string;
    vercelTeamId: string | null | undefined;
}

interface Ctx {
    project: VercelProjectWithCredentials;
    rule: VercelUnderAttackRule;
    logger: ActionLogger;
}

export async function runVercelUnderAttackRule({ project, rule, logger }: Ctx): Promise<void> {
    const db = getDb();
    const { rateLimitThreshold, autoOff, offThreshold, windowSeconds, sendNotification, notifyEmails } = rule;

    // 1. Resolve traffic
    const windowSecs = windowSeconds ?? 300;
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

    // 2. Fetch current attack mode from Vercel API
    const client = new VercelClient(project.vercelToken, project.vercelTeamId);

    let attackModeEnabled = false;
    try {
        const json = await client.projects.get(project.vercelProjectId);
        attackModeEnabled = !!json.security?.attackModeEnabled;
        debugLog(`  Attack Mode: ${attackModeEnabled ? "ON" : "OFF"}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Failed to fetch Vercel project status for ${project.name}:`, msg);
        await logger.logActions([{
            userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
            actionTaken: "VERCEL_ATTACK_MODE_ERROR", targetType: "API_ERROR",
            targetValue: msg.substring(0, 100), requestCount: null,
            metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
        }]);
        return;
    }

    // 3. Threshold logic
    if (totalRequests > rateLimitThreshold) {
        if (!attackModeEnabled) {
            // Check if we recently triggered VERCEL_ATTACK_MODE_ON to avoid duplicate triggers
            const lastOnLog = await db
                .select()
                .from(actionLogs)
                .where(
                    and(
                        eq(actionLogs.ruleId, rule.id),
                        eq(actionLogs.actionTaken, "VERCEL_ATTACK_MODE_ON")
                    )
                )
                .orderBy(desc(actionLogs.timestamp))
                .limit(1);

            if (lastOnLog.length > 0) {
                const elapsedMs = Date.now() - new Date(lastOnLog[0].timestamp).getTime();
                const cooldownMs = windowSecs * 1000;
                if (elapsedMs < cooldownMs) {
                    debugLog(`  Vercel Attack Mode activation is on cooldown (last attempted ${Math.round(elapsedMs / 1000)}s ago, window is ${windowSecs}s). Skipping duplicate trigger.`);
                    return;
                }
            }

            try {
                await client.attackMode.set(project.vercelProjectId, true, Date.now() + 3600000);

                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_ATTACK_MODE_ON", targetType: "PROJECT", targetValue: project.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ rateLimitThreshold, totalRequests }), timestamp: new Date(),
                }]);
                debugLog(`  Enabled Vercel Attack Mode for ${project.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e: string) => e.trim()),
                        subject: `[Alert] Vercel Attack Mode ACTIVATED for ${project.domain || project.name}`,
                        html: vercelAttackOnEmail(project.name, project.domain, totalRequests, rateLimitThreshold, windowSecs),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to enable Vercel Attack Mode:`, msg);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_ATTACK_MODE_ERROR", targetType: "API_ERROR",
                    targetValue: "Activation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Vercel Attack Mode already enabled.`);
        }
    } else if (autoOff && typeof offThreshold === "number" && totalRequests < offThreshold) {
        if (attackModeEnabled) {
            try {
                await client.attackMode.set(project.vercelProjectId, false, 0);

                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_ATTACK_MODE_OFF", targetType: "PROJECT", targetValue: project.name,
                    requestCount: totalRequests,
                    metadata: JSON.stringify({ offThreshold, totalRequests }), timestamp: new Date(),
                }]);
                debugLog(`  Disabled Vercel Attack Mode for ${project.name}.`);

                if (sendNotification && notifyEmails) {
                    await sendEmail({
                        to: notifyEmails.split(",").map((e: string) => e.trim()),
                        subject: `[Resolve] Vercel Attack Mode DEACTIVATED for ${project.domain || project.name}`,
                        html: vercelAttackOffEmail(project.name, project.domain, totalRequests, offThreshold, windowSecs),
                    });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`  Failed to disable Vercel Attack Mode:`, msg);
                await logger.logActions([{
                    userId: project.userId, provider: "vercel", resourceId: project.id, ruleId: rule.id,
                    actionTaken: "VERCEL_ATTACK_MODE_ERROR", targetType: "API_ERROR",
                    targetValue: "Deactivation failed", requestCount: totalRequests,
                    metadata: JSON.stringify({ error: msg }), timestamp: new Date(),
                }]);
            }
        } else {
            debugLog(`  Attack Mode already off.`);
        }
    } else {
        debugLog(`  Traffic (${totalRequests}) in neutral range. No action.`);
    }
}
