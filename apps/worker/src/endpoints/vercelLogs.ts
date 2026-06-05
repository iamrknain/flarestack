import { Context } from 'hono';
import { getWorkerDb } from '../lib/db';
import { eq } from 'drizzle-orm';
import { vercelTrafficStats } from '@flarestack/db/src/schema/vercel';
import type { Env } from '../index';

export async function handleVercelLogs(c: Context<{ Bindings: Env }>) {
    const db = getWorkerDb(c.env);
    const contentType = c.req.header('content-type') || '';
    let logs: any[] = [];

    try {
        if (contentType.includes('application/x-ndjson') || contentType.includes('text/x-ndjson')) {
            const text = await c.req.text();
            logs = text
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        } else {
            // Attempt standard JSON parsing
            const body = await c.req.json();
            logs = Array.isArray(body) ? body : [body];
        }
    } catch (e) {
        // Fallback: try parsing as text and splitting by newline
        try {
            const text = await c.req.text();
            logs = text
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        } catch (innerErr) {
            console.error('[Vercel Logs] Failed to parse payload:', innerErr);
            return c.text('Bad Request', 400);
        }
    }

    if (logs.length === 0) {
        return c.text('No logs found');
    }

    // Group logs by projectId and minute timestamp
    const countsMap = new Map<string, number>(); // key: "projectId:minute"
    for (const log of logs) {
        if (!log.projectId) continue;
        // log.timestamp is in milliseconds. Round to nearest minute (60s)
        const timestamp = log.timestamp || Date.now();
        const minute = Math.floor(timestamp / 60000) * 60; // epoch seconds
        const key = `${log.projectId}:${minute}`;
        countsMap.set(key, (countsMap.get(key) || 0) + 1);
    }

    // Upsert aggregated counts
    for (const [key, count] of countsMap.entries()) {
        const [projectId, minuteStr] = key.split(':');
        const minute = parseInt(minuteStr);
        
        try {
            const existing = await db
                .select()
                .from(vercelTrafficStats)
                .where(eq(vercelTrafficStats.id, key))
                .get();

            if (existing) {
                await db
                    .update(vercelTrafficStats)
                    .set({
                        requestCount: existing.requestCount + count,
                        updatedAt: new Date()
                    })
                    .where(eq(vercelTrafficStats.id, key));
            } else {
                await db
                    .insert(vercelTrafficStats)
                    .values({
                        id: key,
                        projectId,
                        minute,
                        requestCount: count,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
            }
        } catch (dbErr) {
            console.error(`[Vercel Logs] Failed to write stats for key ${key}:`, dbErr);
        }
    }

    return c.text('OK');
}
