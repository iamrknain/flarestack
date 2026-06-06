"use server";

import { headers } from "next/headers";
import { getDb } from "~/db";
import { requireAuth, getSession } from "~/lib/auth";
import { cloudflareAccounts, zoneConfigs, addIpToListRules, underAttackRules, entityCache, actionLogs, wafRules } from "~/db/schema";
import { eq, and, inArray, desc, sql, gte, lte } from "drizzle-orm";
import { CloudflareClient } from "~/lib/cloudflare";
import { ListCache } from "~/db/list-cache";

import { getRangeConditions } from "~/lib/filter";

async function getClient(accountRef: string, apiTokenOverride?: string) {
  const user = await requireAuth();
  const db = getDb();
  
  const [account] = await db
    .select()
    .from(cloudflareAccounts)
    .where(and(eq(cloudflareAccounts.id, accountRef), eq(cloudflareAccounts.userId, user.id)));
    
  if (!account) {
    throw new Error("Cloudflare Account not found");
  }
  
  const apiToken = apiTokenOverride && apiTokenOverride.trim().length > 0
    ? apiTokenOverride.trim()
    : account.cfApiToken;
  
  return {
    cf: new CloudflareClient(account.cfAccountId, apiToken),
    db,
  };
}

export async function getZonesAction(accountRef: string) {
  try {
    const { cf } = await getClient(accountRef);
    return await cf.zones.getZones();
  } catch (error: any) {
    return { error: error.message || "Failed to fetch zones" };
  }
}

export async function getListsAction(accountRef: string, apiTokenOverride?: string) {
  try {
    const { cf } = await getClient(accountRef, apiTokenOverride);
    return await cf.lists.getLists();
  } catch (error: any) {
    return { error: error.message || "Failed to fetch lists" };
  }
}

export async function getListItemsAction(accountRef: string, listId: string, limit?: number, search?: string, bypassCache = false) {
  try {
    const { cf, db } = await getClient(accountRef);
    const listCache = new ListCache(db, cf, listId);
    return await listCache.search(search ?? '', limit, bypassCache);
  } catch (error: any) {
    return { error: error.message || "Failed to fetch list items" };
  }
}

export async function addListItemsAction(accountRef: string, listId: string, items: { ip: string; comment?: string }[]) {
  try {
    const { cf, db } = await getClient(accountRef);
    const listCache = new ListCache(db, cf, listId);

    const result = await cf.lists.addItems(listId, items);
    await listCache.syncAfterAdd(items);

    return { success: true, added: items.length, operationId: result };
  } catch (error: any) {
    return { error: error.message || "Failed to add items to list" };
  }
}

export async function deleteListItemsAction(accountRef: string, listId: string, values: string[]) {
  if (values.length === 0) return { success: true, deleted: 0, operationIds: [] };
  try {
    const { cf, db } = await getClient(accountRef);
    const listCache = new ListCache(db, cf, listId);

    // Resolve CF UUIDs for each value: db first, CF search fallback for nulls
    const itemIds = await listCache.resolveIds(values);
    if (itemIds.length === 0) return { error: "Could not resolve CF item IDs for the given values" };

    const operationIds = await cf.lists.deleteItems(listId, itemIds);
    await listCache.syncAfterRemove(values);

    return { success: true, deleted: itemIds.length, operationIds };
  } catch (error: any) {
    return { error: error.message || "Failed to delete list items" };
  }
}

/**
 * Full rebuild of the db cache for a list from Cloudflare.
 * After this, comment/description searches are served instantly from db.
 * Called when the user clicks the Cache button.
 */
export async function syncListItemsCacheAction(accountRef: string, listId: string) {
  try {
    const { cf, db } = await getClient(accountRef);
    const synced = await new ListCache(db, cf, listId).fullSync();
    return { success: true, synced };
  } catch (error: any) {
    return { error: error.message || "Failed to sync list items cache" };
  }
}

export async function clearListItemsCacheAction(accountRef: string, listId: string) {
  try {
    const { cf, db } = await getClient(accountRef);
    await new ListCache(db, cf, listId).clear();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to clear list items cache" };
  }
}

export async function getListCacheStatusAction(accountRef: string, listId: string) {
  try {
    const { cf, db } = await getClient(accountRef);
    return await new ListCache(db, cf, listId).status();
  } catch (error: any) {
    return { error: error.message || "Failed to get cache status" };
  }
}

export async function getTopStatsAction(accountRef: string, zoneTag: string, dimensions: string[], windowSeconds?: number, limit = 10, searchQuery?: string) {
  try {
    const { cf } = await getClient(accountRef);
    return await cf.analytics.getTopStats({
      zoneTag,
      dimensions,
      windowSeconds,
      limit,
      searchQuery,
    });
  } catch (error: any) {
    return { error: error.message || "Failed to fetch top stats" };
  }
}

export async function getCloudflareDataAction(searchParams: any) {
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
      zonesResult,
      recentActionsResult,
      countResult,
      ...ruleResults
    ] = await Promise.all([
      db
        .select()
        .from(cloudflareAccounts)
        .where(eq(cloudflareAccounts.userId as any, userId))
        .orderBy(desc(cloudflareAccounts.createdAt)),
      db
        .select()
        .from(zoneConfigs)
        .where(eq(zoneConfigs.userId as any, userId))
        .orderBy(desc(zoneConfigs.createdAt)),
      db
        .select()
        .from(actionLogs)
        .where(and(...conditions, eq(actionLogs.provider as any, "cloudflare")))
        .orderBy(desc(actionLogs.timestamp))
        .limit(10),
      db
        .select({ count: sql<number>`count(*)` })
        .from(actionLogs)
        .where(and(...conditions, eq(actionLogs.provider as any, "cloudflare"))),
      db.select().from(addIpToListRules).where(eq(addIpToListRules.userId as any, userId)).orderBy(desc(addIpToListRules.createdAt)),
      db.select().from(underAttackRules).where(eq(underAttackRules.userId as any, userId)).orderBy(desc(underAttackRules.createdAt)),
      db.select().from(wafRules).where(eq(wafRules.userId as any, userId)).orderBy(desc(wafRules.createdAt)),
    ]);

    const totalBlocks = (countResult[0]?.count ?? 0) as number;
    const rules = [
      ...(ruleResults[0] as any[]).map((r) => ({ ...r, type: "add_ip_to_list" })),
      ...(ruleResults[1] as any[]).map((r) => ({ ...r, type: "under_attack_mode" })),
      ...(ruleResults[2] as any[]).map((r) => ({ ...r, type: "waf_rule" })),
    ];

    return {
      success: true,
      data: {
        accounts: accountsResult,
        zones: zonesResult,
        recentActions: recentActionsResult,
        totalBlocks,
        rules,
      }
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to fetch data" };
  }
}

export async function getIpsDataAction() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  try {
    const userId = sessionData.user.id;
    const db = getDb();
    const [zonesResult, accountsResult] = await Promise.all([
      db
        .select()
        .from(zoneConfigs)
        .where(eq(zoneConfigs.userId as any, userId))
        .orderBy(desc(zoneConfigs.createdAt)),
      db
        .select()
        .from(cloudflareAccounts)
        .where(eq(cloudflareAccounts.userId as any, userId))
        .orderBy(desc(cloudflareAccounts.createdAt)),
    ]);

    return {
      success: true,
      data: {
        zones: zonesResult,
        accounts: accountsResult,
      }
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to fetch data" };
  }
}

export async function getListsDataAction() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  try {
    const userId = sessionData.user.id;
    const db = getDb();
    const accountsResult = await db
      .select()
      .from(cloudflareAccounts)
      .where(eq(cloudflareAccounts.userId as any, userId))
      .orderBy(desc(cloudflareAccounts.createdAt));

    return {
      success: true,
      data: {
        accounts: accountsResult,
      }
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to fetch data" };
  }
}

export async function addCloudflareAccount(label: string, cfAccountId: string, cfApiToken: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!label || !cfAccountId || !cfApiToken) {
    return { error: "All fields are required." };
  }

  if (!/^[a-fA-F0-9]{32,45}$/.test(cfAccountId)) {
    return { error: "Invalid Account ID format. It must be between 32 and 45 alphanumeric characters." };
  }

  try {
    const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${cfApiToken}` },
    });
    const verifyJson = (await verifyRes.json()) as { success: boolean; errors?: { message: string }[] };
    if (!verifyRes.ok || !verifyJson.success) {
      const detail = verifyJson.errors?.[0]?.message || `HTTP ${verifyRes.status}`;
      return { error: `Invalid API Token. Cloudflare rejected it: ${detail}` };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Could not reach Cloudflare to verify the token: ${errMsg}` };
  }

  await db.insert(cloudflareAccounts).values({
    id: crypto.randomUUID(),
    userId,
    label,
    cfAccountId,
    cfApiToken,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteCloudflareAccount(accountId: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  const dependentZones = await db
    .select()
    .from(zoneConfigs)
    .where(and(eq(zoneConfigs.cfAccountRef as any, accountId), eq(zoneConfigs.userId as any, userId)) as any);
  if (dependentZones.length > 0) {
    return { error: `Cannot delete — ${dependentZones.length} zone(s) still use this account. Remove those zones first.` };
  }
  
  await db
    .delete(cloudflareAccounts)
    .where(and(eq(cloudflareAccounts.id as any, accountId), eq(cloudflareAccounts.userId as any, userId)) as any);
    
  return { success: true };
}

export async function editCloudflareAccount(accountId: string, label: string, cfAccountId: string, cfApiToken?: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!label || !cfAccountId) {
    return { error: "All fields except API Token are required." };
  }

  if (!/^[a-fA-F0-9]{32,45}$/.test(cfAccountId)) {
    return { error: "Invalid Account ID format. It must be between 32 and 45 alphanumeric characters." };
  }

  const [existing] = await db
    .select()
    .from(cloudflareAccounts)
    .where(and(eq(cloudflareAccounts.id, accountId), eq(cloudflareAccounts.userId as any, userId)) as any);

  if (!existing) {
    return { error: "Account not found." };
  }

  const finalToken = cfApiToken && cfApiToken.trim().length > 0 ? cfApiToken : existing.cfApiToken;

  if (cfApiToken && cfApiToken.trim().length > 0) {
    try {
      const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: { Authorization: `Bearer ${finalToken}` },
      });
      const verifyJson = (await verifyRes.json()) as { success: boolean; errors?: { message: string }[] };
      if (!verifyRes.ok || !verifyJson.success) {
        const detail = verifyJson.errors?.[0]?.message || `HTTP ${verifyRes.status}`;
        return { error: `Invalid API Token. Cloudflare rejected it: ${detail}` };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return { error: `Could not reach Cloudflare to verify the token: ${errMsg}` };
    }
  }

  await db.update(cloudflareAccounts)
    .set({
      label,
      cfAccountId,
      cfApiToken: finalToken,
      updatedAt: new Date(),
    })
    .where(and(eq(cloudflareAccounts.id, accountId), eq(cloudflareAccounts.userId as any, userId)) as any);

  return { success: true };
}

export async function editZone(zoneId: string, name: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!name) {
    return { error: "Website Name is required." };
  }

  await db.update(zoneConfigs)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(zoneConfigs.id, zoneId), eq(zoneConfigs.userId as any, userId)) as any);

  return { success: true };
}

export async function editAddIpToListRule(ruleId: string, data: {
  name: string;
  cfListId: string;
  cfListName: string;
  rateLimitThreshold: number;
  windowSeconds: number;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.update(addIpToListRules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(addIpToListRules.id, ruleId), eq(addIpToListRules.userId as any, userId)) as any);

  return { success: true };
}

export async function editUnderAttackRule(ruleId: string, data: {
  name: string;
  rateLimitThreshold: number;
  autoOff: boolean;
  offThreshold?: number | null;
  recoveryLevel?: string | null;
  windowSeconds: number;
  sendNotification: boolean;
  notifyEmails?: string | null;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.update(underAttackRules)
    .set({
      ...data,
      recoveryLevel: data.recoveryLevel || "medium",
      updatedAt: new Date(),
    })
    .where(and(eq(underAttackRules.id, ruleId), eq(underAttackRules.userId as any, userId)) as any);

  return { success: true };
}

export async function addZone(name: string, cfZoneId: string, cfAccountRef: string, domain?: string | null) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  if (!name || !cfZoneId || !cfAccountRef) {
    return { error: "All fields are required." };
  }

  await db.insert(zoneConfigs).values({
    id: crypto.randomUUID(),
    userId,
    cfAccountRef,
    name,
    cfZoneId,
    domain: domain || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteZone(zoneId: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  const rulesInZone = await db
    .select({ cfListId: addIpToListRules.cfListId })
    .from(addIpToListRules)
    .where(and(eq(addIpToListRules.zoneConfigId as any, zoneId), eq(addIpToListRules.userId as any, userId)) as any);

  const cacheNamespaces = rulesInZone.map((r: any) => `cf_list:${r.cfListId}`);

  await db.transaction(async (tx: any) => {
    await tx.delete(actionLogs).where(and(
      eq(actionLogs.provider as any, "cloudflare"),
      eq(actionLogs.resourceId as any, zoneId),
      eq(actionLogs.userId as any, userId)
    ) as any);
    
    await tx.delete(addIpToListRules).where(and(eq(addIpToListRules.zoneConfigId as any, zoneId), eq(addIpToListRules.userId as any, userId)) as any);
      await tx.delete(underAttackRules).where(and(eq(underAttackRules.zoneConfigId as any, zoneId), eq(underAttackRules.userId as any, userId)) as any);
      await tx.delete(wafRules).where(and(eq(wafRules.zoneConfigId as any, zoneId), eq(wafRules.userId as any, userId)) as any);

    if (cacheNamespaces.length > 0) {
      await tx.delete(entityCache).where(inArray(entityCache.namespace as any, cacheNamespaces) as any);
    }

    await tx.delete(zoneConfigs).where(and(eq(zoneConfigs.id as any, zoneId), eq(zoneConfigs.userId as any, userId)) as any);
  });
  return { success: true };
}

export async function toggleZoneStatus(zoneId: string, isActive: boolean) {
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
      .update(zoneConfigs)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(zoneConfigs.id as any, zoneId), eq(zoneConfigs.userId as any, userId)) as any);
    
    await tx.update(addIpToListRules).set({ isActive, updatedAt: new Date() }).where(and(eq(addIpToListRules.zoneConfigId as any, zoneId), eq(addIpToListRules.userId as any, userId)) as any);
      await tx.update(underAttackRules).set({ isActive, updatedAt: new Date() }).where(and(eq(underAttackRules.zoneConfigId as any, zoneId), eq(underAttackRules.userId as any, userId)) as any);
      await tx.update(wafRules).set({ isActive, updatedAt: new Date() }).where(and(eq(wafRules.zoneConfigId as any, zoneId), eq(wafRules.userId as any, userId)) as any);
  });
  return { success: true };
}

export async function createAddIpToListRule(data: {
  name: string;
  zoneConfigId: string;
  cfListId: string;
  cfListName: string;
  rateLimitThreshold: number;
  windowSeconds: number;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.insert(addIpToListRules).values({
    id: crypto.randomUUID(),
    userId,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function createUnderAttackRule(data: {
  name: string;
  zoneConfigId: string;
  rateLimitThreshold: number;
  autoOff: boolean;
  offThreshold?: number | null;
  recoveryLevel?: string | null;
  windowSeconds: number;
  sendNotification: boolean;
  notifyEmails?: string | null;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.insert(underAttackRules).values({
    id: crypto.randomUUID(),
    userId,
    ...data,
    recoveryLevel: data.recoveryLevel || "medium",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteCloudflareRule(ruleId: string, ruleType: string) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  if (ruleId) {
    if (ruleType === "add_ip_to_list") {
      const [ruleRow] = await db.select().from(addIpToListRules).where(and(eq(addIpToListRules.id as any, ruleId), eq(addIpToListRules.userId as any, userId)) as any);
      await db.transaction(async (tx: any) => {
        await tx.delete(actionLogs).where(eq(actionLogs.ruleId as any, ruleId) as any);
        await tx.delete(addIpToListRules).where(and(eq(addIpToListRules.id as any, ruleId), eq(addIpToListRules.userId as any, userId)) as any);
        if (ruleRow?.cfListId) {
          await tx.delete(entityCache).where(eq(entityCache.namespace as any, `cf_list:${ruleRow.cfListId}`) as any);
        }
      });
    } else if (ruleType === "under_attack_mode") {
      await db.transaction(async (tx: any) => {
        await tx.delete(actionLogs).where(eq(actionLogs.ruleId as any, ruleId) as any);
        await tx.delete(underAttackRules).where(and(eq(underAttackRules.id as any, ruleId), eq(underAttackRules.userId as any, userId)) as any);
      });
    } else if (ruleType === "waf_rule") {
      await db.transaction(async (tx: any) => {
        await tx.delete(actionLogs).where(eq(actionLogs.ruleId as any, ruleId) as any);
        await tx.delete(wafRules).where(and(eq(wafRules.id as any, ruleId), eq(wafRules.userId as any, userId)) as any);
      });
    }
  }
  return { success: true };
}

export async function toggleCloudflareRuleStatus(ruleId: string, ruleType: string, isActive: boolean) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  if (ruleId) {
    if (ruleType === "add_ip_to_list") {
      await db.update(addIpToListRules).set({ isActive, updatedAt: new Date() }).where(and(eq(addIpToListRules.id as any, ruleId), eq(addIpToListRules.userId as any, userId)) as any);
    } else if (ruleType === "under_attack_mode") {
      await db.update(underAttackRules).set({ isActive, updatedAt: new Date() }).where(and(eq(underAttackRules.id as any, ruleId), eq(underAttackRules.userId as any, userId)) as any);
    } else if (ruleType === "waf_rule") {
      await db.update(wafRules).set({ isActive, updatedAt: new Date() }).where(and(eq(wafRules.id as any, ruleId), eq(wafRules.userId as any, userId)) as any);
    }
  }
  return { success: true };
}

export async function validateTokenPermissionsAction(
  zoneConfigId: string,
  ruleType: "add_ip_to_list" | "under_attack_mode" | "waf_rule",
  cfApiTokenOverride?: string
) {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);

  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  const db = getDb();

  const [zone] = await db
    .select()
    .from(zoneConfigs)
    .where(and(eq(zoneConfigs.id, zoneConfigId), eq(zoneConfigs.userId as any, userId)) as any);

  if (!zone) {
    return { error: "Zone configuration not found." };
  }

  const [account] = await db
    .select()
    .from(cloudflareAccounts)
    .where(and(eq(cloudflareAccounts.id, zone.cfAccountRef), eq(cloudflareAccounts.userId as any, userId)) as any);

  if (!account) {
    return { error: "Cloudflare Account not found." };
  }

  const apiToken = cfApiTokenOverride && cfApiTokenOverride.trim().length > 0
    ? cfApiTokenOverride.trim()
    : account.cfApiToken;

  const cf = new CloudflareClient(account.cfAccountId, apiToken);
  const checks: { name: string; passed: boolean; error?: string; requiredPermission: string }[] = [];

  // 1. Check Analytics (Common to all rules)
  try {
    await cf.analytics.getTopStats({
      zoneTag: zone.cfZoneId,
      dimensions: [],
      limit: 1,
      windowSeconds: 60,
    });
    checks.push({
      name: "Analytics Access",
      passed: true,
      requiredPermission: "Zone > Analytics > Read",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or invalid query";
    checks.push({
      name: "Analytics Access",
      passed: false,
      error: message,
      requiredPermission: "Zone > Analytics > Read",
    });
  }

  // 2. Rule-specific checks
  if (ruleType === "add_ip_to_list") {
    try {
      await cf.lists.getLists();
      checks.push({
        name: "IP List Management",
        passed: true,
        requiredPermission: "Account > IP Lists > Read & Account > IP Lists > Edit",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unauthorized access to IP lists";
      checks.push({
        name: "IP List Management",
        passed: false,
        error: message,
        requiredPermission: "Account > IP Lists > Read & Account > IP Lists > Edit",
      });
    }
  } else if (ruleType === "under_attack_mode") {
    let currentLevel: string | null = null;
    try {
      currentLevel = await cf.zones.getSecurityLevel(zone.cfZoneId);
      checks.push({
        name: "Zone Settings (Read)",
        passed: true,
        requiredPermission: "Zone > Zone Settings > Read",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unauthorized settings read";
      checks.push({
        name: "Zone Settings (Read)",
        passed: false,
        error: message,
        requiredPermission: "Zone > Zone Settings > Read",
      });
    }

    if (currentLevel) {
      try {
        await cf.zones.setSecurityLevel(zone.cfZoneId, currentLevel as "under_attack" | "essentially_off" | "low" | "medium" | "high");
        checks.push({
          name: "Zone Settings (Edit)",
          passed: true,
          requiredPermission: "Zone > Zone Settings > Edit",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unauthorized settings write";
        checks.push({
          name: "Zone Settings (Edit)",
          passed: false,
          error: message,
          requiredPermission: "Zone > Zone Settings > Edit",
        });
      }
    } else {
      checks.push({
        name: "Zone Settings (Edit)",
        passed: false,
        error: "Skipped edit permission check because read check failed.",
        requiredPermission: "Zone > Zone Settings > Edit",
      });
    }
  } else if (ruleType === "waf_rule") {
    try {
      await cf.rulesets.getRulesets(zone.cfZoneId);
      checks.push({
        name: "Zone WAF (Read & Edit)",
        passed: true,
        requiredPermission: "Zone > Zone WAF > Edit",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unauthorized WAF read/edit";
      checks.push({
        name: "Zone WAF (Read & Edit)",
        passed: false,
        error: message,
        requiredPermission: "Zone > Zone WAF > Edit",
      });
    }
  }

  const allPassed = checks.every((c) => c.passed);
  return { success: true, allPassed, checks };
}

export async function getWafRulesAction(accountRef: string, cfZoneId: string, apiTokenOverride?: string) {
  try {
    const { cf } = await getClient(accountRef, apiTokenOverride);
    const rulesets = await cf.rulesets.getRulesets(cfZoneId);
    
    // Find the custom WAF ruleset (phase: http_request_firewall_custom, kind: zone)
    const customRuleset = rulesets.find(
      (r) => r.phase === "http_request_firewall_custom" && r.kind === "zone"
    );
    
    if (!customRuleset) {
      return { success: true, ruleset: null, rules: [] };
    }
    
    // Fetch the full ruleset to get the rules inside it
    const fullRuleset = await cf.rulesets.getRuleset(cfZoneId, customRuleset.id);
    return { success: true, ruleset: fullRuleset, rules: fullRuleset.rules ?? [] };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch WAF rules" };
  }
}

export async function createWafRuleAction(data: {
  name: string;
  zoneConfigId: string;
  cfRulesetId: string;
  cfRuleId: string;
  cfRuleName: string;
  rateLimitThreshold: number;
  windowSeconds: number;
  autoOff: boolean;
  offThreshold?: number | null;
  sendNotification: boolean;
  notifyEmails?: string | null;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.insert(wafRules).values({
    id: crypto.randomUUID(),
    userId,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function editWafRuleAction(ruleId: string, data: {
  name: string;
  cfRulesetId: string;
  cfRuleId: string;
  cfRuleName: string;
  rateLimitThreshold: number;
  windowSeconds: number;
  autoOff: boolean;
  offThreshold?: number | null;
  sendNotification: boolean;
  notifyEmails?: string | null;
  cfApiTokenOverride?: string | null;
}) {
  const db = getDb();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;

  await db.update(wafRules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(wafRules.id, ruleId), eq(wafRules.userId as any, userId)) as any);

  return { success: true };
}

export async function fetchIpDetailsAction(ip: string) {
  const cleanIp = ip.split("/")[0].trim();
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  try {
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`);
    if (!res.ok) throw new Error("ipapi.co failed");
    const data = await res.json();
    if (data.error) throw new Error(data.reason || "ipapi.co returned error");
    return data;
  } catch (err) {
    try {
      const res = await fetch(`https://freeipapi.com/api/json/${cleanIp}`);
      if (!res.ok) throw new Error("freeipapi failed");
      const data = await res.json();
      return {
        ip: data.ipAddress || cleanIp,
        network: data.ipAddress,
        version: data.ipVersion === 4 ? "IPv4" : "IPv6",
        city: data.cityName,
        region: data.regionName,
        country_name: data.countryName,
        country_code: data.countryCode,
        latitude: data.latitude ?? data.lat,
        longitude: data.longitude ?? data.lon,
        timezone: data.timeZone,
        asn: data.asn ? `AS${data.asn}` : undefined,
        org: data.isp || data.organizationName,
        country_capital: "",
        country_tld: "",
        country_calling_code: "",
        currency_name: "",
        languages: "",
        utc_offset: ""
      };
    } catch (fallbackErr) {
      return { ip: cleanIp, error: "Unable to retrieve IP details" };
    }
  }
}


