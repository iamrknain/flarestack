/**
 * FlareStack Background Cron Worker
 * 
 * This background worker periodically triggers the Cloudflare and Vercel WAF rule execution endpoints.
 * It requires `CRON_API_TOKEN` to be set in your `.env` file or environment variables.
 * 
 * Usage:
 *   pnpm run cron-worker [options]
 * 
 * Options:
 *   --url=<target_url>       The base target URL (Default: http://localhost:3000)
 *   --interval=<seconds>     The trigger interval in seconds (Default: 10)
 * 
 * Examples:
 *   # Target local dev dashboard (http://localhost:3000)
 *   pnpm run cron-worker
 * 
 *   # Target production URL with custom interval (30 seconds)
 *   pnpm run cron-worker --url=https://flarestack-dashboard.vercel.app --interval=30
 */

import fs from "fs";
import path from "path";

// Helper to load env variables from a file path
function loadEnv(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf-8");
    content.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match) {
            process.env[match[1]] = match[2];
        }
    });
}

// Load .env from workspace root
const rootDir = process.cwd();
loadEnv(path.join(rootDir, ".env"));

const token = process.env.CRON_API_TOKEN;
if (!token) {
    console.error("❌ Error: CRON_API_TOKEN is not set in process.env or .env file.");
    process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
const intervalArg = args.find((a) => a.startsWith("--interval="));
const urlArg = args.find((a) => a.startsWith("--url="));

const intervalSec = intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 10; // default 10s
const intervalMs = intervalSec * 1000;
const baseUrl = urlArg ? urlArg.split("=")[1] : "http://localhost:3000";

console.log("⏰ FlareStack Background Cron Worker started.");
console.log(`📡 Targeting API endpoints at: ${baseUrl}`);
console.log(`⏱️ Running interval: ${intervalSec} seconds`);
console.log("==========================================");

async function triggerEndpoint(name: string, endpointPath: string) {
    const url = `${baseUrl}${endpointPath}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const text = await res.text();
        let payload: any = {};
        try {
            payload = JSON.parse(text);
        } catch {
            payload = { raw: text };
        }

        if (res.ok) {
            console.log(`[${new Date().toLocaleTimeString()}] ✅ ${name} Cron: Success! User: ${payload.user || "OK"}`);
        } else {
            console.error(`[${new Date().toLocaleTimeString()}] ❌ ${name} Cron: Failed (${res.status}). Error: ${payload.error || text}`);
        }
    } catch (err: any) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ ${name} Cron: Network Error:`, err.message || err);
    }
}

async function runTick() {
    await Promise.all([
        triggerEndpoint("Cloudflare", "/api/cron/cloudflare"),
        triggerEndpoint("Vercel", "/api/cron/vercel"),
    ]);
}

// Execute immediately, then set interval
runTick();
setInterval(runTick, intervalMs);
