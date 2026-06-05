import { eq, gte, lte, or, ilike } from "drizzle-orm";
import { actionLogs } from "~/db/schema";

export function getRangeConditions(userId: string, searchParams: { [key: string]: string | string[] | undefined }) {
  const rangeType = (searchParams.type as string) || "relative";
  const relativeValue = (searchParams.relative as string) || "30m";
  const startStr = searchParams.start as string;
  const endStr = searchParams.end as string;
  const zoneIdFilter = searchParams.zoneId as string;
  const projectIdFilter = searchParams.projectId as string;
  const q = searchParams.q as string;

  const conditions = [eq(actionLogs.userId as any, userId)];

  if (zoneIdFilter) {
    conditions.push(
      eq(actionLogs.provider as any, "cloudflare"),
      eq(actionLogs.resourceId as any, zoneIdFilter)
    );
  } else if (projectIdFilter) {
    conditions.push(
      eq(actionLogs.provider as any, "vercel"),
      eq(actionLogs.resourceId as any, projectIdFilter)
    );
  }

  if (q && q.trim()) {
    const pattern = `%${q.trim()}%`;
    conditions.push(
      or(
        ilike(actionLogs.provider, pattern),
        ilike(actionLogs.resourceId, pattern),
        ilike(actionLogs.ruleId, pattern),
        ilike(actionLogs.actionTaken, pattern),
        ilike(actionLogs.targetType, pattern),
        ilike(actionLogs.targetValue, pattern),
        ilike(actionLogs.metadata, pattern)
      ) as any
    );
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

  return conditions;
}
