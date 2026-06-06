"use server";

import { getDb } from "~/db";
import { vercelProjects, vercelAccounts, vercelUnderAttackRules, vercelBotProtectionRules, vercelTrafficStats } from "~/db/schema/vercel";
import { eq, and, inArray, lt, sql } from "drizzle-orm";
import { ActivityLogger } from "~/lib/logger";
import { runVercelUnderAttackRule, type VercelProjectWithCredentials } from "./underAttackMode";
import { runVercelBotProtectionRule } from "./botProtection";

export async function runVercelCron(userId: string): Promise<void> {
    const db = getDb();
    const logger = new ActivityLogger(db);

    // 1. Load active Vercel projects for this user
    const projects = await db
        .select()
        .from(vercelProjects)
        .where(and(eq(vercelProjects.userId, userId), eq(vercelProjects.isActive, true)));

    if (projects.length === 0) {
        console.log("[cron/vercel] No active Vercel projects found.");
        return;
    }

    // 2. Load Vercel accounts in one query
    const accountRefs = [...new Set(projects.map((p) => p.vercelAccountRef))];
    const accounts = await db
        .select()
        .from(vercelAccounts)
        .where(inArray(vercelAccounts.id, accountRefs));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const projectIds = projects.map((p) => p.id);

    // 3. Load all active rules in one batch
    const [attackRules, botRules] = await Promise.all([
        db.select().from(vercelUnderAttackRules)
            .where(and(inArray(vercelUnderAttackRules.vercelProjectRef, projectIds), eq(vercelUnderAttackRules.isActive, true))),
        db.select().from(vercelBotProtectionRules)
            .where(and(inArray(vercelBotProtectionRules.vercelProjectRef, projectIds), eq(vercelBotProtectionRules.isActive, true))),
    ]);

    const minutesSinceEpoch = Math.floor(Date.now() / (60 * 1000));

    // 4. Process all projects concurrently
    await Promise.allSettled(
        projects.map(async (project) => {
            const account = accountMap.get(project.vercelAccountRef);
            if (!account) {
                console.error(`[cron/vercel] No account found for project ${project.name}`);
                return;
            }

            const projectWithCreds: VercelProjectWithCredentials = {
                ...project,
                vercelToken: account.vercelToken,
                vercelTeamId: account.vercelTeamId,
            };

            const projectAttackRules = attackRules.filter((r) => r.vercelProjectRef === project.id);
            const projectBotRules = botRules.filter((r) => r.vercelProjectRef === project.id);

            for (const rule of projectAttackRules) {
                if (!isDue(rule.windowSeconds ?? 300, minutesSinceEpoch)) continue;
                try {
                    await runVercelUnderAttackRule({ project: projectWithCreds, rule, logger });
                } catch (err) {
                    console.error(`[cron/vercel] Rule ${rule.id} failed:`, err);
                }
            }

            for (const rule of projectBotRules) {
                if (!isDue(rule.windowSeconds ?? 300, minutesSinceEpoch)) continue;
                try {
                    await runVercelBotProtectionRule({ project: projectWithCreds, rule, logger });
                } catch (err) {
                    console.error(`[cron/vercel] Rule ${rule.id} failed:`, err);
                }
            }
        })
    );

    console.log(`[cron/vercel] Done. Processed ${projects.length} project(s).`);

    // TODO: Needs Reconsideration
    // 5. Prune old traffic stats (keep last 2 hours max — rules never look further back)
    try {
        const cutoffSecs = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
        await db.delete(vercelTrafficStats).where(lt(vercelTrafficStats.minute, cutoffSecs));
    } catch (err) {
        console.warn("[cron/vercel] Stats cleanup failed (non-fatal):", err);
    }
}

function isDue(windowSeconds: number, minutesSinceEpoch: number): boolean {
    const interval = Math.max(1, Math.floor(windowSeconds / 60));
    return (minutesSinceEpoch % interval) === 0;
}
