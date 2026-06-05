import { Hono } from 'hono';
import { runCronTasks } from './cron';
import { handleVercelLogs } from './endpoints/vercelLogs';

// Shared Env bindings
export interface Env {
    DB: D1Database;
    DEBUG: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('OK'));

app.post('/api/vercel-logs', handleVercelLogs);

export default {
    // 1. Fetch event (Hono router for explicit API calls from outside the dashboard)
    fetch: app.fetch,
 
    // 2. Scheduled event (Cron trigger — runs every minute per wrangler.jsonc)
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        console.log(`Cron triggered at ${new Date(event.scheduledTime).toISOString()}`);
        ctx.waitUntil(runCronTasks(env));
    },
};
