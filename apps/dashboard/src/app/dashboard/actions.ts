"use server";

import { headers } from "next/headers";
import { getDb } from "~/lib/db";
import { getAuth } from "~/lib/auth";
import { cloudflareAccounts, zoneConfigs, addIpToListRules, actionLogs } from "@flarestack/db/src/schema/zones";
import { vercelAccounts, vercelProjects, vercelUnderAttackRules, vercelBotProtectionRules } from "@flarestack/db/src/schema/vercel";
import { entityCache } from "@flarestack/db/src/schema/cache";
import { and, eq, inArray } from "drizzle-orm";
import { RULE_REGISTRY } from "~/lib/rules/registry";

export async function dashboardAction(formData: FormData) {
  const db = getDb();
  const auth = getAuth();
  const reqHeaders = await headers();
  const sessionData = await auth.api.getSession({ headers: reqHeaders });
  
  if (!sessionData?.user) {
    return { error: "Unauthorized. Please log in." };
  }

  const userId = sessionData.user.id;
  const intent = formData.get("intent") as string;

  try {
    if (intent === "add_account") {
      const label = formData.get("label") as string;
      const cfAccountId = formData.get("cfAccountId") as string;
      const cfApiToken = formData.get("cfApiToken") as string;

      if (!label || !cfAccountId || !cfApiToken) {
        return { error: "All fields are required." };
      }

      // Cloudflare Account IDs are hex strings, typically 32 to 45 characters.
      if (!/^[a-fA-F0-9]{32,45}$/.test(cfAccountId)) {
        return { error: "Invalid Account ID format. It must be between 32 and 45 alphanumeric characters." };
      }

      // Verify the token is valid at all
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

    if (intent === "add_zone") {
      const name = formData.get("name") as string;
      const cfZoneId = formData.get("cfZoneId") as string;
      const cfAccountRef = formData.get("cfAccountRef") as string;
      const domain = formData.get("domain") as string;

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

    if (intent === "add_rule") {
      const ruleType = formData.get("ruleType") as string;
      const config = RULE_REGISTRY[ruleType];

      if (config?.table && config.prepareValues) {
        const values = config.prepareValues(formData);
        await db.insert(config.table).values({
          id: crypto.randomUUID(),
          userId,
          ...values,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return { success: true };
    }

    if (intent === "delete_account") {
      const accountId = formData.get("accountId") as string;
      if (accountId) {
        // Guard: refuse if any zones in THIS tenant still reference this account
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
      }
      return { success: true };
    }

    if (intent === "delete_zone") {
      const zoneId = formData.get("zoneId") as string;
      if (zoneId) {
        // Find all cfListIds in this zone's rules so we can wipe their cache entries.
        const rulesInZone = await db
          .select({ cfListId: addIpToListRules.cfListId })
          .from(addIpToListRules)
          .where(and(eq(addIpToListRules.zoneConfigId as any, zoneId), eq(addIpToListRules.userId as any, userId)) as any);

        const cacheNamespaces = rulesInZone.map((r: any) => `cf_list:${r.cfListId}`);

        // D1/SQLite-compatible transaction block
        await db.transaction(async (tx: any) => {
          await tx.delete(actionLogs).where(and(eq(actionLogs.zoneConfigId as any, zoneId), eq(actionLogs.userId as any, userId)) as any);
          
          for (const c of Object.values(RULE_REGISTRY).filter((c) => c.table)) {
            await tx.delete(c.table as any).where(and(eq((c.table as any).zoneConfigId as any, zoneId), eq((c.table as any).userId as any, userId)) as any);
          }

          if (cacheNamespaces.length > 0) {
            await tx.delete(entityCache).where(inArray(entityCache.namespace as any, cacheNamespaces) as any);
          }

          await tx.delete(zoneConfigs).where(and(eq(zoneConfigs.id as any, zoneId), eq(zoneConfigs.userId as any, userId)) as any);
        });
      }
      return { success: true };
    }

    if (intent === "delete_rule") {
      const ruleId = formData.get("ruleId") as string;
      const ruleType = formData.get("ruleType") as string;
      const config = RULE_REGISTRY[ruleType];

      if (ruleId && config) {
        // Fetch the rule first so we can clear its cache namespace.
        const [ruleRow] = await db
          .select()
          .from(config.table as any)
          .where(and(eq((config.table as any).id as any, ruleId), eq((config.table as any).userId as any, userId)) as any);

        await db.transaction(async (tx: any) => {
          await tx.delete(actionLogs).where(eq(actionLogs.ruleId as any, ruleId) as any);
          await tx.delete(config.table as any).where(and(eq((config.table as any).id as any, ruleId), eq((config.table as any).userId as any, userId)) as any);
          
          if (ruleRow?.cfListId) {
            await tx.delete(entityCache).where(eq(entityCache.namespace as any, `cf_list:${ruleRow.cfListId}`) as any);
          }
        });
      }
      return { success: true };
    }

    if (intent === "toggle_zone_status") {
      const zoneId = formData.get("zoneId") as string;
      const isActive = formData.get("isActive") === "true";
      if (zoneId) {
        await db.transaction(async (tx: any) => {
          await tx
            .update(zoneConfigs)
            .set({ isActive, updatedAt: new Date() })
            .where(and(eq(zoneConfigs.id as any, zoneId), eq(zoneConfigs.userId as any, userId)) as any);
          
          for (const c of Object.values(RULE_REGISTRY).filter((c) => c.table)) {
            await tx
              .update(c.table as any)
              .set({ isActive, updatedAt: new Date() })
              .where(and(eq((c.table as any).zoneConfigId as any, zoneId), eq((c.table as any).userId as any, userId)) as any);
          }
        });
      }
      return { success: true };
    }

    if (intent === "toggle_rule_status") {
      const ruleId = formData.get("ruleId") as string;
      const ruleType = formData.get("ruleType") as string;
      const isActive = formData.get("isActive") === "true";
      const config = RULE_REGISTRY[ruleType];

      if (ruleId && config) {
        await db
          .update(config.table as any)
          .set({ isActive, updatedAt: new Date() })
          .where(and(eq((config.table as any).id as any, ruleId), eq((config.table as any).userId as any, userId)) as any);
      }
      return { success: true };
    }

    if (intent === "update_profile") {
      const name = formData.get("name") as string;
      if (name) {
        await auth.api.updateUser({
          headers: reqHeaders,
          body: { name },
        });
      }
      return { success: true, redirect: "/dashboard/profile" };
    }

    if (intent === "add_vercel_account") {
      const label = formData.get("label") as string;
      const vercelToken = formData.get("vercelToken") as string;
      const vercelTeamId = formData.get("vercelTeamId") as string;

      if (!label || !vercelToken) {
        return { error: "Label and Token are required." };
      }

      // Verify the Vercel API token
      try {
        const url = vercelTeamId 
          ? `https://api.vercel.com/v9/projects?teamId=${vercelTeamId}` 
          : "https://api.vercel.com/v9/projects";
        const verifyRes = await fetch(url, {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        if (!verifyRes.ok) {
          return { error: `Invalid Vercel API Token or Team ID. Vercel returned HTTP ${verifyRes.status}` };
        }
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

    if (intent === "delete_vercel_account") {
      const accountId = formData.get("accountId") as string;
      if (accountId) {
        // Refuse if any projects reference this account
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
      }
      return { success: true };
    }

    if (intent === "add_vercel_project") {
      const name = formData.get("name") as string;
      const vercelProjectId = formData.get("vercelProjectId") as string;
      const vercelAccountRef = formData.get("vercelAccountRef") as string;
      const domain = formData.get("domain") as string;

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

    if (intent === "delete_vercel_project") {
      const projectId = formData.get("projectId") as string;
      if (projectId) {
        await db.transaction(async (tx: any) => {
          // Delete action logs referencing this project
          await tx.delete(actionLogs).where(and(eq(actionLogs.vercelProjectRef as any, projectId), eq(actionLogs.userId as any, userId)) as any);
          
          // Delete Vercel rules
          await tx.delete(vercelUnderAttackRules).where(and(eq(vercelUnderAttackRules.vercelProjectRef as any, projectId), eq(vercelUnderAttackRules.userId as any, userId)) as any);
          await tx.delete(vercelBotProtectionRules).where(and(eq(vercelBotProtectionRules.vercelProjectRef as any, projectId), eq(vercelBotProtectionRules.userId as any, userId)) as any);
          
          // Delete project
          await tx.delete(vercelProjects).where(and(eq(vercelProjects.id as any, projectId), eq(vercelProjects.userId as any, userId)) as any);
        });
      }
      return { success: true };
    }

    if (intent === "toggle_vercel_project_status") {
      const projectId = formData.get("projectId") as string;
      const isActive = formData.get("isActive") === "true";
      if (projectId) {
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
      }
      return { success: true };
    }

    return { error: "Unknown intent: " + intent };
  } catch (err) {
    console.error("Dashboard action error:", err);
    return { error: err instanceof Error ? err.message : "Internal action error" };
  }
}
