import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";
import { getAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { cloudflareAccounts, zoneConfigs, actionLogs } from "@flarestack/db/src/schema/zones";
import { RULE_REGISTRY } from "~/lib/rules/registry";
import DashboardClientPage from "~/components/dashboard/DashboardClientPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  description: "Monitor your Cloudflare zones, manage IP blocking rules, and review recent threat activity - all in one place.",
};

interface PageProps {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardTabPage({ params, searchParams }: PageProps) {
  const { tab } = await params;
  const resolvedSearchParams = await searchParams;

  const allowedTabs = ["overview", "ips", "logs", "lists", "profile"];
  if (!allowedTabs.includes(tab)) {
    redirect("/dashboard/overview");
  }

  const auth = getAuth();
  const reqHeaders = await headers();
  const sessionData = await auth.api.getSession({ headers: reqHeaders });

  if (!sessionData?.user) {
    redirect("/auth?mode=login");
  }

  const userId = sessionData.user.id;
  const db = getDb();

  const activeRuleConfigs = Object.values(RULE_REGISTRY).filter((c) => c.table);

  const rangeType = (resolvedSearchParams.type as string) || "relative";
  const relativeValue = (resolvedSearchParams.relative as string) || "30m";
  const startStr = resolvedSearchParams.start as string;
  const endStr = resolvedSearchParams.end as string;
  const queryLimit = Math.min(
    parseInt((resolvedSearchParams.limit as string) || (tab === "logs" ? "100" : "10")),
    1000
  );
  const zoneIdFilter = resolvedSearchParams.zoneId as string;

  const conditions = [eq(actionLogs.userId as any, userId)];

  if (zoneIdFilter) {
    conditions.push(eq(actionLogs.zoneConfigId as any, zoneIdFilter));
  }

  if (rangeType === "relative") {
    const num = parseInt(relativeValue);
    const unit = relativeValue.slice(-1);
    let ms = 30 * 60000;
    if (unit === "m") ms = num * 60000;
    else if (unit === "h") ms = num * 3600000;
    else if (unit === "d") ms = num * 86400000;
    conditions.push(gte(actionLogs.timestamp as any, new Date(Date.now() - ms)));
  } else if (rangeType === "absolute" && startStr) {
    conditions.push(gte(actionLogs.timestamp as any, new Date(startStr)));
    if (endStr) conditions.push(lte(actionLogs.timestamp as any, new Date(endStr)));
  }

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
      .where(and(...conditions))
      .orderBy(desc(actionLogs.timestamp))
      .limit(queryLimit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(actionLogs)
      .where(and(...conditions)),
    ...activeRuleConfigs.map((c) =>
      db
        .select()
        .from(c.table as any)
        .where(eq((c.table as any).userId as any, userId))
        .orderBy(desc((c.table as any).createdAt))
    ),
  ]);

  const totalBlocks = (countResult[0]?.count ?? 0) as number;

  const rules = ruleResults.flatMap((res, i) => {
    const type = activeRuleConfigs[i].type;
    return (res as Record<string, unknown>[]).map((r) => ({ ...r, type }));
  });

  return (
    <DashboardClientPage
      user={sessionData.user}
      accounts={accountsResult}
      zones={zonesResult}
      rules={rules}
      recentActions={recentActionsResult}
      totalBlocks={totalBlocks}
      currentTab={tab}
    />
  );
}
