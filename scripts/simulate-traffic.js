/**
 * FlareStack Traffic Simulator Utility
 * 
 * This script simulates traffic for rules testing:
 * 1. Vercel Log Drain Mode (default): Sends mock NDJSON logs to the local worker's /api/vercel-logs endpoint,
 *    then triggers the worker's cron rules execution loop via /__scheduled.
 * 2. Cloudflare / Real Traffic Mode: Fires a burst of concurrent real HTTP requests directly to a target URL or domain.
 * 
 * Usage:
 *   pnpm simulate-traffic [options]
 * 
 * Options:
 *   --type=<vercel|cloudflare>        The simulation type (Default: vercel)
 *   --target=<project_id|domain_url>  Vercel project ID (e.g. prj_xyz) or domain URL (e.g. gogoxgeorgia.com)
 *                                     (Default Vercel: read from .env.vercel)
 *   --count=<number>                  Number of requests/logs to simulate (Default: 5000)
 *   --worker-url=<url>                The local worker base URL (Default: http://localhost:8787)
 * 
 * Examples:
 *   # Simulate 5,000 requests for Vercel project (using .env.vercel configurations)
 *   pnpm simulate-traffic
 * 
 *   # Simulate 10,000 requests for a specific Vercel project
 *   pnpm simulate-traffic --target=prj_KJYQcK95OecOvZHHMZwq0tpn3N0j --count=10000
 * 
 *   # Simulate 500 real HTTP requests to a Cloudflare zone/domain
 *   pnpm simulate-traffic --type=cloudflare --target=gogoxgeorgia.com --count=500
 */



const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const fs = require('fs');
const path = require('path');

// Helper to load env variables from a file path
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match) {
            env[match[1]] = match[2];
        }
    });
    return env;
}

const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='));
const targetArg = args.find(a => a.startsWith('--target='));
const countArg = args.find(a => a.startsWith('--count='));
const workerUrlArg = args.find(a => a.startsWith('--worker-url='));

const type = typeArg ? typeArg.split('=')[1] : 'vercel'; // default vercel
let target = targetArg ? targetArg.split('=')[1] : null;
const count = countArg ? parseInt(countArg.split('=')[1], 10) : 5000;
const workerUrl = workerUrlArg ? workerUrlArg.split('=')[1] : 'http://localhost:8787';

async function main() {
    console.log('▶ [START] FlareStack Traffic Simulator');
    console.log('===============================');
    
    if (type === 'vercel') {
        // Load default vercel project id if not specified
        if (!target) {
            const vercelEnv = loadEnv(path.join(__dirname, '../.env.vercel'));
            target = vercelEnv.VERCEL_PROJECT_ID;
        }
        
        if (!target) {
            console.error('✖ [ERROR] Vercel projectId not specified and VERCEL_PROJECT_ID not found in .env.vercel');
            process.exit(1);
        }
        
        console.log(`\n❖ Simulating ${count} Vercel request logs for Project ID: ${target}`);
        console.log(`🔗 Target worker endpoint: ${workerUrl}/api/vercel-logs`);
        
        // Generate NDJSON payload
        let payload = '';
        const now = Date.now();
        for (let i = 0; i < count; i++) {
            // Distribute logs slightly over the last minute to look natural
            const timestamp = now - Math.floor(Math.random() * 30 * 1000);
            payload += JSON.stringify({
                projectId: target,
                timestamp: timestamp
            }) + '\n';
        }
        
        try {
            console.log('Sending logs payload...');
            const startTime = Date.now();
            const res = await fetch(`${workerUrl}/api/vercel-logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-ndjson'
                },
                body: payload
            });
            
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Worker returned status ${res.status}: ${text}`);
            }
            
            console.log(`✔ Success: Logs sent in ${Date.now() - startTime}ms.`);
            
            // Trigger scheduled cron task on worker
            console.log('⧗ Triggering worker cron rules execution...');
            const cronRes = await fetch(`${workerUrl}/__scheduled`, {
                method: 'POST'
            });
            
            if (cronRes.ok) {
                console.log('✔ Success: Scheduled cron trigger completed.');
            } else {
                console.log(`⚠ Warning: Cron trigger returned status ${cronRes.status}`);
            }
            
        } catch (err) {
            console.error('✖ Error sending logs:', err.message);
            process.exit(1);
        }
        
    } else if (type === 'cloudflare' || type === 'real') {
        if (!target) {
            console.error('✖ Error: Target domain or URL required (e.g. --target=https://gogoxgeorgia.com)');
            process.exit(1);
        }
        
        // Ensure protocol
        let url = target;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        console.log(`\n✦ Sending ${count} real HTTP requests to ${url}`);
        
        const startTime = Date.now();
        let completed = 0;
        let failed = 0;
        const concurrency = 20;
        
        async function worker() {
            while (completed + failed < count) {
                const id = completed + failed;
                if (id >= count) break;
                
                try {
                    // Cache buster to ensure requests hit the server/CDN
                    const separator = url.includes('?') ? '&' : '?';
                    const targetUrl = `${url}${separator}cb=${Math.random()}`;
                    
                    const res = await fetch(targetUrl, {
                        headers: {
                            'User-Agent': 'FlareStack-Traffic-Simulator/1.0'
                        }
                    });
                    
                    if (res.ok) {
                        completed++;
                    } else {
                        failed++;
                    }
                } catch (err) {
                    failed++;
                }
                
                // Log progress
                const total = completed + failed;
                if (total % 100 === 0 || total === count) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rps = (total / elapsed).toFixed(1);
                    console.log(`Progress: ${total}/${count} requests sent | OK: ${completed} | Failed: ${failed} | Speed: ${rps} req/sec`);
                }
            }
        }
        
        // Run pool
        const pool = Array.from({ length: concurrency }, () => worker());
        await Promise.all(pool);
        
        console.log(`\n✔ Finished sending real HTTP requests. Total OK: ${completed}, Failed: ${failed}.`);
    } else {
        console.error('✖ Error: Invalid type. Supported types: vercel, cloudflare');
        process.exit(1);
    }
}

main();