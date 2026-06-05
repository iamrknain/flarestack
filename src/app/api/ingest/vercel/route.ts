import crypto from "crypto";
import { NextRequest } from "next/server";
import { getDb } from "~/db";
import { vercelTrafficStats } from "~/db/schema/vercel";
import { sql } from "drizzle-orm";

// ── Constants ────────────────────────────────────────────────────────────────

/** Request sources that represent real inbound traffic (not build/CI logs) */
const TRAFFIC_SOURCES = new Set(["lambda", "edge", "static", "external", "firewall", "redirect"]);

// ── Signature verification ────────────────────────────────────────────────────

function sha1(body: Buffer, secret: string): string {
    return crypto.createHmac("sha1", secret).update(body).digest("hex");
}

function verifySignature(rawBody: Buffer, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const expected = sha1(rawBody, secret);
    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
        return false;
    }
}

// ── Log entry type (Vercel Log Drain format) ──────────────────────────────────

interface VercelLogEntry {
    id?: string;
    source?: string;
    projectId?: string;
    timestamp?: number;    // milliseconds
    statusCode?: number;
    path?: string;
    requestId?: string;
    environment?: string;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
    const secret = process.env.VERCEL_LOG_DRAIN_SECRET;
    if (!secret) {
        console.error("[ingest/vercel] VERCEL_LOG_DRAIN_SECRET not configured.");
        return Response.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // 1. Read raw body (must be raw for HMAC — do NOT use req.json() first)
    const rawBody = Buffer.from(await req.arrayBuffer());

    // 2. Verify Vercel signature (HMAC-SHA1 of raw body)
    const signature = req.headers.get("x-vercel-signature");
    if (!verifySignature(rawBody, signature, secret)) {
        console.warn("[ingest/vercel] Invalid signature rejected.");
        return Response.json({ error: "Invalid signature" }, { status: 403 });
    }

    // 3. Parse JSON payload (Vercel sends a JSON array of log entries)
    let logs: VercelLogEntry[];
    try {
        logs = JSON.parse(rawBody.toString("utf-8"));
        if (!Array.isArray(logs)) throw new Error("Payload is not an array");
    } catch (err) {
        console.error("[ingest/vercel] Failed to parse payload:", err);
        return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // 4. Filter to real request-generating log sources only
    const requestLogs = logs.filter(
        (l) => l.projectId && l.timestamp && TRAFFIC_SOURCES.has(l.source ?? "")
    );

    if (requestLogs.length === 0) {
        // Nothing to count — respond 200 immediately (build logs, etc.)
        return Response.json({ ok: true, counted: 0 });
    }

    // 5. Aggregate per (projectId, minute) — avoids one INSERT per log line
    //    `minute` = Unix seconds floored to the minute boundary
    const counts = new Map<string, { projectId: string; minute: number; count: number }>();

    for (const log of requestLogs) {
        const minute = Math.floor(log.timestamp! / 60000) * 60; // ms → minute-aligned seconds
        const key = `${log.projectId}:${minute}`;
        const existing = counts.get(key);
        if (existing) {
            existing.count++;
        } else {
            counts.set(key, { projectId: log.projectId!, minute, count: 1 });
        }
    }

    // 6. Upsert aggregated counts — ON CONFLICT increment existing bucket
    const db = getDb();
    const rows = [...counts.values()];

    try {
        await db
            .insert(vercelTrafficStats)
            .values(rows.map(({ projectId, minute, count }) => ({
                projectId,
                minute,
                requestCount: count,
                updatedAt: new Date(),
            })))
            .onConflictDoUpdate({
                target: [vercelTrafficStats.projectId, vercelTrafficStats.minute],
                set: {
                    requestCount: sql`${vercelTrafficStats.requestCount} + EXCLUDED.request_count`,
                    updatedAt: sql`NOW()`,
                },
            });
    } catch (err) {
        console.error("[ingest/vercel] DB upsert failed:", err);
        return Response.json({ error: "Database error" }, { status: 500 });
    }

    console.log(`[ingest/vercel] Ingested ${requestLogs.length} log entries → ${rows.length} minute bucket(s).`);
    return Response.json({ ok: true, counted: requestLogs.length, buckets: rows.length });
}
