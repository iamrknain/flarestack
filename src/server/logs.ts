"use server";

import { getDb } from "~/db";
import { requireAuth } from "~/lib/auth";
import { actionLogs, zoneConfigs, vercelProjects } from "~/db/schema";
import { desc, eq, inArray, and, gte, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getSession } from "~/lib/auth";
import { getRangeConditions } from "~/lib/filter";

export async function getLogsAction(params: {
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

    const conditions = [eq(actionLogs.userId, user.id)];

    if (params.zoneId || (params.provider === "cloudflare" && params.resourceId)) {
      conditions.push(
        eq(actionLogs.provider, "cloudflare"),
        eq(actionLogs.resourceId, (params.zoneId || params.resourceId)!)
      );
    } else if (params.projectId || (params.provider === "vercel" && params.resourceId)) {
      conditions.push(
        eq(actionLogs.provider, "vercel"),
        eq(actionLogs.resourceId, (params.projectId || params.resourceId)!)
      );
    } else if (params.resourceId && params.provider) {
      conditions.push(
        eq(actionLogs.provider, params.provider),
        eq(actionLogs.resourceId, params.resourceId)
      );
    }

    if (params.actions) {
      const actionArray = params.actions.split(",").map(a => a.trim()).filter(Boolean);
      if (actionArray.length > 0) {
        conditions.push(inArray(actionLogs.actionTaken, actionArray));
      }
    }

    const cutoffTimeMs = Date.now() - (windowSeconds * 1000);
    conditions.push(gte(actionLogs.timestamp, new Date(cutoffTimeMs)));

    const logs = await db.select()
      .from(actionLogs)
      .where(and(...conditions))
      .orderBy(desc(actionLogs.timestamp))
      .limit(limit);

    return logs;
  } catch (error: any) {
    return { error: error.message || "Failed to fetch logs" };
  }
}


export async function getLogsDataAction(searchParams: any) {
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
        .from(actionLogs)
        .where(and(...conditions))
        .orderBy(desc(actionLogs.timestamp))
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
    return { error: "Failed to fetch data" };
  }
}

export async function deleteActionLogsAction(logIds: string[]) {
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
    
    await db.delete(actionLogs)
      .where(and(
        eq(actionLogs.userId, userId),
        inArray(actionLogs.id, logIds)
      ));
    
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "Failed to delete action logs" };
  }
}

