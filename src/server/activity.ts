"use server";

import { getDb } from "~/db";
import { requireAuth } from "~/lib/auth";
import { activityLogs, zoneConfigs, vercelProjects } from "~/db/schema";
import { desc, eq, inArray, and, gte, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getSession } from "~/lib/auth";
import { getRangeConditions } from "~/lib/filter";

export async function getActivityLogsAction(params: {
  zoneId?: string;
  projectId?: string;
  resourceId?: string;
  provider?: string;
  actions?: string;
  limit?: number;
  windowSeconds?: number;
}) {
  try {
    const user = await requireAuth();
    const db = getDb();

    const limit = Math.min(params.limit || 100, 1000);
    const windowSeconds = params.windowSeconds || 3600;

    const conditions = [eq(activityLogs.userId, user.id)];

    if (params.zoneId || (params.provider === "cloudflare" && params.resourceId)) {
      conditions.push(
        eq(activityLogs.provider, "cloudflare"),
        eq(activityLogs.resourceId, (params.zoneId || params.resourceId)!)
      );
    } else if (params.projectId || (params.provider === "vercel" && params.resourceId)) {
      conditions.push(
        eq(activityLogs.provider, "vercel"),
        eq(activityLogs.resourceId, (params.projectId || params.resourceId)!)
      );
    } else if (params.resourceId && params.provider) {
      conditions.push(
        eq(activityLogs.provider, params.provider),
        eq(activityLogs.resourceId, params.resourceId)
      );
    }

    if (params.actions) {
      const actionArray = params.actions.split(",").map(a => a.trim()).filter(Boolean);
      if (actionArray.length > 0) {
        conditions.push(inArray(activityLogs.actionTaken, actionArray));
      }
    }

    const cutoffTimeMs = Date.now() - (windowSeconds * 1000);
    conditions.push(gte(activityLogs.timestamp, new Date(cutoffTimeMs)));

    const logs = await db.select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);

    return logs;
  } catch (error: any) {
    return { error: error.message || "Failed to fetch activity logs" };
  }
}

export async function getActivityDataAction(searchParams: any) {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  try {
    const userId = sessionData.user.id;
    const db = getDb();
    const conditions = getRangeConditions(userId, searchParams);
    const queryLimit = Math.min(
      parseInt((searchParams.limit as string) || "100"),
      1000
    );

    const [zonesResult, projectsResult, logsResult] = await Promise.all([
      db
        .select()
        .from(zoneConfigs)
        .where(eq(zoneConfigs.userId as any, userId))
        .orderBy(desc(zoneConfigs.createdAt)),
      db
        .select()
        .from(vercelProjects)
        .where(eq(vercelProjects.userId as any, userId))
        .orderBy(desc(vercelProjects.createdAt)),
      db
        .select()
        .from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.timestamp))
        .limit(queryLimit),
    ]);

    return {
      success: true,
      data: {
        zones: zonesResult,
        projects: projectsResult,
        recentActions: logsResult,
      }
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to fetch activity data" };
  }
}

export async function deleteActivityLogsAction(logIds: string[]) {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  if (!logIds || logIds.length === 0) {
    return { error: "No log IDs provided" };
  }
  try {
    const userId = sessionData.user.id;
    const db = getDb();
    
    await db.delete(activityLogs)
      .where(and(
        eq(activityLogs.userId, userId),
        inArray(activityLogs.id, logIds)
      ));
    
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "Failed to delete activity logs" };
  }
}
