"use server";

import { headers } from "next/headers";
import { getDb } from "~/db";
import { getSession, requireAuth } from "~/lib/auth";
import { vercelAccounts, vercelProjects, vercelUnderAttackRules, vercelBotProtectionRules, activityLogs, zoneConfigs } from "~/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getRangeConditions } from "~/lib/filter";
import { VercelClient } from "~/lib/vercel";


async function getClient(accountRef: string) {
  const user = await requireAuth();
  const db = getDb();
  
  const [account] = await db
    .select()
    .from(vercelAccounts)
    .where(and(eq(vercelAccounts.id, accountRef), eq(vercelAccounts.userId, user.id)));
    
  if (!account) {
    throw new Error("Vercel Account not found");
  }
  
  return {
    account,
    db,
  };
}

export async function getVercelProjectsAction(accountRef: string) {
  try {
    const { account } = await getClient(accountRef);
    const client = new VercelClient(account.vercelToken, account.vercelTeamId);
    const projects = await client.projects.list();

    return projects.map((p) => ({
        id: p.id,
        name: p.name,
        domain: p.targets?.production?.domain || (p.alias?.[0] || ""),
    }));
  } catch (error: any) {
    return { error: error.message || "Failed to fetch Vercel projects" };
  }
}

export async function getVercelDataAction(searchParams: any) {
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

    const [
      accountsResult,
      projectsResult,
      recentActionsResult,
      countResult,
      zonesResult,
      ...ruleResults
    ] = await Promise.all([
      db
        .select()
        .from(vercelAccounts)
        .where(eq(vercelAccounts.userId as any, userId))
        .orderBy(desc(vercelAccounts.createdAt)),
      db
        .select()
        .from(vercelProjects)
        .where(eq(vercelProjects.userId as any, userId))
        .orderBy(desc(vercelProjects.createdAt)),
      db
        .select()
        .from(activityLogs)
        .where(and(...conditions, eq(activityLogs.provider as any, "vercel")))
        .orderBy(desc(activityLogs.timestamp))
        .limit(10),
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(and(...conditions, eq(activityLogs.provider as any, "vercel"))),
      db
        .select()
        .from(zoneConfigs)
        .where(eq(zoneConfigs.userId as any, userId))
        .orderBy(desc(zoneConfigs.createdAt)),
      db.select().from(vercelUnderAttackRules).where(eq(vercelUnderAttackRules.userId as any, userId)).orderBy(desc(vercelUnderAttackRules.createdAt)),
      db.select().from(vercelBotProtectionRules).where(eq(vercelBotProtectionRules.userId as any, userId)).orderBy(desc(vercelBotProtectionRules.createdAt)),
    ]);

    const totalBlocks = (countResult[0]?.count ?? 0) as number;
    const rules = [
      ...(ruleResults[0] as any[]).map((r) => ({ ...r, type: "vercel_under_attack_mode" })),
      ...(ruleResults[1] as any[]).map((r) => ({ ...r, type: "vercel_bot_protection" })),
    ];

    return {
      success: true,
      data: {
        vercelAccounts: accountsResult,
        vercelProjects: projectsResult,
        recentActions: recentActionsResult,
        totalBlocks,
        rules,
        zoneConfigs: zonesResult,
      }
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to fetch data" };
  }
}

export async function addVercelAccount(label: string, vercelToken: string, vercelTeamId?: string | null) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!label || !vercelToken) {
    return { error: "Label and Token are required." };
  }

  try {
    const client = new VercelClient(vercelToken, vercelTeamId);
    await client.projects.list();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Could not reach Vercel to verify the token: ${errMsg}` };
  }

  await db.insert(vercelAccounts).values({
    id: crypto.randomUUID(),
    userId,
    label,
    vercelToken,
    vercelTeamId: vercelTeamId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteVercelAccount(accountId: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  const dependentProjects = await db
    .select()
    .from(vercelProjects)
    .where(and(eq(vercelProjects.vercelAccountRef as any, accountId), eq(vercelProjects.userId as any, userId)) as any);
  if (dependentProjects.length > 0) {
    return { error: `Cannot delete — ${dependentProjects.length} project(s) still use this account. Remove those projects first.` };
  }
  
  await db
    .delete(vercelAccounts)
    .where(and(eq(vercelAccounts.id as any, accountId), eq(vercelAccounts.userId as any, userId)) as any);
    
  return { success: true };
}

export async function addVercelProject(name: string, vercelProjectId: string, vercelAccountRef: string, domain?: string | null) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!name || !vercelProjectId || !vercelAccountRef) {
    return { error: "Name, Project ID, and Vercel Account are required." };
  }

  await db.insert(vercelProjects).values({
    id: crypto.randomUUID(),
    userId,
    vercelAccountRef,
    name,
    vercelProjectId,
    domain: domain || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteVercelProject(projectId: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.transaction(async (tx: any) => {
    await tx.delete(activityLogs).where(and(
      eq(activityLogs.provider as any, "vercel"),
      eq(activityLogs.resourceId as any, projectId),
      eq(activityLogs.userId as any, userId)
    ) as any);
    await tx.delete(vercelUnderAttackRules).where(and(eq(vercelUnderAttackRules.vercelProjectRef as any, projectId), eq(vercelUnderAttackRules.userId as any, userId)) as any);
    await tx.delete(vercelBotProtectionRules).where(and(eq(vercelBotProtectionRules.vercelProjectRef as any, projectId), eq(vercelBotProtectionRules.userId as any, userId)) as any);
    await tx.delete(vercelProjects).where(and(eq(vercelProjects.id as any, projectId), eq(vercelProjects.userId as any, userId)) as any);
  });
  return { success: true };
}

export async function toggleVercelProjectStatus(projectId: string, isActive: boolean) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.transaction(async (tx: any) => {
    await tx
      .update(vercelProjects)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(vercelProjects.id as any, projectId), eq(vercelProjects.userId as any, userId)) as any);

    await tx
      .update(vercelUnderAttackRules)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(vercelUnderAttackRules.vercelProjectRef as any, projectId), eq(vercelUnderAttackRules.userId as any, userId)) as any);

    await tx
      .update(vercelBotProtectionRules)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(vercelBotProtectionRules.vercelProjectRef as any, projectId), eq(vercelBotProtectionRules.userId as any, userId)) as any);
  });
  return { success: true };
}

export async function createVercelUnderAttackRule(data: {
  name: string;
  vercelProjectRef: string;
  trafficSource?: string | null;
  cfZoneConfigRef?: string | null;
  rateLimitThreshold: number;
  autoOff: boolean;
  offThreshold?: number | null;
  windowSeconds: number;
  sendNotification: boolean;
  notifyEmails?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.insert(vercelUnderAttackRules).values({
    id: crypto.randomUUID(),
    userId,
    name: data.name,
    vercelProjectRef: data.vercelProjectRef,
    trafficSource: data.trafficSource ?? 'vercel_drain',
    cfZoneConfigRef: data.cfZoneConfigRef || null,
    rateLimitThreshold: data.rateLimitThreshold,
    autoOff: data.autoOff,
    offThreshold: data.offThreshold || null,
    windowSeconds: data.windowSeconds,
    sendNotification: data.sendNotification,
    notifyEmails: data.notifyEmails || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function createVercelBotProtectionRule(data: {
  name: string;
  vercelProjectRef: string;
  trafficSource?: string | null;
  cfZoneConfigRef?: string | null;
  rateLimitThreshold: number;
  autoOff: boolean;
  offThreshold?: number | null;
  windowSeconds: number;
  action: string;
  sendNotification: boolean;
  notifyEmails?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.insert(vercelBotProtectionRules).values({
    id: crypto.randomUUID(),
    userId,
    name: data.name,
    vercelProjectRef: data.vercelProjectRef,
    trafficSource: data.trafficSource ?? 'vercel_drain',
    cfZoneConfigRef: data.cfZoneConfigRef || null,
    rateLimitThreshold: data.rateLimitThreshold,
    autoOff: data.autoOff,
    offThreshold: data.offThreshold || null,
    windowSeconds: data.windowSeconds,
    action: data.action,
    sendNotification: data.sendNotification,
    notifyEmails: data.notifyEmails || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteVercelRule(ruleId: string, ruleType: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  if (ruleId) {
    if (ruleType === "vercel_under_attack_mode") {
      await db.transaction(async (tx: any) => {
        await tx.delete(activityLogs).where(eq(activityLogs.ruleId as any, ruleId) as any);
        await tx.delete(vercelUnderAttackRules).where(and(eq(vercelUnderAttackRules.id as any, ruleId), eq(vercelUnderAttackRules.userId as any, userId)) as any);
      });
    } else if (ruleType === "vercel_bot_protection") {
      await db.transaction(async (tx: any) => {
        await tx.delete(activityLogs).where(eq(activityLogs.ruleId as any, ruleId) as any);
        await tx.delete(vercelBotProtectionRules).where(and(eq(vercelBotProtectionRules.id as any, ruleId), eq(vercelBotProtectionRules.userId as any, userId)) as any);
      });
    }
  }
  return { success: true };
}

export async function toggleVercelRuleStatus(ruleId: string, ruleType: string, isActive: boolean) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  if (ruleId) {
    if (ruleType === "vercel_under_attack_mode") {
      await db.update(vercelUnderAttackRules).set({ isActive, updatedAt: new Date() }).where(and(eq(vercelUnderAttackRules.id as any, ruleId), eq(vercelUnderAttackRules.userId as any, userId)) as any);
    } else if (ruleType === "vercel_bot_protection") {
      await db.update(vercelBotProtectionRules).set({ isActive, updatedAt: new Date() }).where(and(eq(vercelBotProtectionRules.id as any, ruleId), eq(vercelBotProtectionRules.userId as any, userId)) as any);
    }
  }
  return { success: true };
}

export async function editVercelAccount(accountId: string, label: string, vercelToken?: string, vercelTeamId?: string | null) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!label) {
    return { error: "Label is required." };
  }

  const [existing] = await db
    .select()
    .from(vercelAccounts)
    .where(and(eq(vercelAccounts.id, accountId), eq(vercelAccounts.userId as any, userId)) as any);

  if (!existing) {
    return { error: "Account not found." };
  }

  const finalToken = vercelToken && vercelToken.trim().length > 0 ? vercelToken : existing.vercelToken;

  if (vercelToken && vercelToken.trim().length > 0) {
    try {
      const client = new VercelClient(finalToken, vercelTeamId);
      await client.projects.list();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return { error: `Could not reach Vercel to verify the token: ${errMsg}` };
    }
  }

  await db
    .update(vercelAccounts)
    .set({
      label,
      vercelToken: finalToken,
      vercelTeamId: vercelTeamId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(vercelAccounts.id, accountId), eq(vercelAccounts.userId as any, userId)) as any);

  return { success: true };
}

export async function editVercelUnderAttackRule(
  ruleId: string,
  data: {
    name: string;
    trafficSource?: string | null;
    cfZoneConfigRef?: string | null;
    rateLimitThreshold: number;
    autoOff: boolean;
    offThreshold?: number | null;
    windowSeconds: number;
    sendNotification: boolean;
    notifyEmails?: string | null;
  }
) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db
    .update(vercelUnderAttackRules)
    .set({
      name: data.name,
      trafficSource: data.trafficSource ?? 'vercel_drain',
      cfZoneConfigRef: data.cfZoneConfigRef || null,
      rateLimitThreshold: data.rateLimitThreshold,
      autoOff: data.autoOff,
      offThreshold: data.offThreshold || null,
      windowSeconds: data.windowSeconds,
      sendNotification: data.sendNotification,
      notifyEmails: data.notifyEmails || null,
      updatedAt: new Date(),
    })
    .where(and(eq(vercelUnderAttackRules.id as any, ruleId), eq(vercelUnderAttackRules.userId as any, userId)) as any);

  return { success: true };
}

export async function editVercelBotProtectionRule(
  ruleId: string,
  data: {
    name: string;
    trafficSource?: string | null;
    cfZoneConfigRef?: string | null;
    rateLimitThreshold: number;
    autoOff: boolean;
    offThreshold?: number | null;
    windowSeconds: number;
    action: string;
    sendNotification: boolean;
    notifyEmails?: string | null;
  }
) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db
    .update(vercelBotProtectionRules)
    .set({
      name: data.name,
      trafficSource: data.trafficSource ?? 'vercel_drain',
      cfZoneConfigRef: data.cfZoneConfigRef || null,
      rateLimitThreshold: data.rateLimitThreshold,
      autoOff: data.autoOff,
      offThreshold: data.offThreshold || null,
      windowSeconds: data.windowSeconds,
      action: data.action,
      sendNotification: data.sendNotification,
      notifyEmails: data.notifyEmails || null,
      updatedAt: new Date(),
    })
    .where(and(eq(vercelBotProtectionRules.id as any, ruleId), eq(vercelBotProtectionRules.userId as any, userId)) as any);

  return { success: true };
}

export async function editVercelProject(
  projectId: string,
  name: string,
  vercelProjectId: string,
  vercelAccountRef: string,
  domain?: string | null
) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!name || !vercelProjectId || !vercelAccountRef) {
    return { error: "Name, Project ID, and Vercel Account are required." };
  }

  const [existing] = await db
    .select()
    .from(vercelProjects)
    .where(and(eq(vercelProjects.id, projectId), eq(vercelProjects.userId as any, userId)) as any);

  if (!existing) {
    return { error: "Project not found." };
  }

  await db
    .update(vercelProjects)
    .set({
      name,
      vercelProjectId,
      vercelAccountRef,
      domain: domain || null,
      updatedAt: new Date(),
    })
    .where(and(eq(vercelProjects.id, projectId), eq(vercelProjects.userId as any, userId)) as any);

  return { success: true };
}
