// ============================================
// FlareStack — Worker Deployment Script
// ============================================
//
// Usage: pnpm run deploy-worker
//
// Handles on first-run infrastructure creation,
// config file updates, DB migrations, and worker
// deployment in one command.
// ============================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Terminal Styles ──────────────────────────
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

const ICON = {
    success: '✔',
    error: '✖',
    warn: '⚠',
    info: 'ℹ',
    step: '›',
    arrow: '→',
};

function header(title) {
    const border = '─'.repeat(44);
    console.log(`\n${C.bold}${C.blue}┌${border}┐${C.reset}`);
    console.log(`${C.bold}${C.blue}│  ${title.padEnd(44)}│${C.reset}`);
    console.log(`${C.bold}${C.blue}└${border}┘${C.reset}\n`);
}

function step(msg) { console.log(`${C.cyan}${ICON.step} ${msg}...${C.reset}`); }
function success(msg) { console.log(`${C.green}${ICON.success} ${msg}${C.reset}`); }
function warn(msg) { console.log(`${C.yellow}${ICON.warn} ${msg}${C.reset}`); }
function error(msg) { console.log(`${C.red}${ICON.error} ${msg}${C.reset}`); }
function info(msg) { console.log(`${C.dim}${ICON.info} ${msg}${C.reset}`); }
function kv(key, val) { console.log(`   ${ICON.arrow} ${C.bold}${key}:${C.reset} ${val}`); }
function divider() { console.log(`${C.dim}${'─'.repeat(44)}${C.reset}`); }

// ── Shell Helper ─────────────────────────────
function run(command, options = {}) {
    const stdio = (options.silent || options.captureError) ? 'pipe' : 'inherit';
    
    try {
        const stdout = execSync(command, { 
            encoding: 'utf8', 
            stdio: stdio
        });
        
        if (!options.silent && options.captureError && stdout) {
            process.stdout.write(stdout);
        }
        
        return stdout;
    } catch (err) {
        if (options.ignoreError) return err.stdout || err.message;
        
        if (options.captureError) throw err;

        error(`Command failed: ${command}`);
        if (err.stdout) console.log(err.stdout.toString());
        if (err.stderr) console.error(err.stderr.toString());
        process.exit(1);
    }
}

// ── Deploy ───────────────────────────────────
async function deploy() {
    header('FlareStack  Worker Deployment');

    // ── 1. Auth Check ────────────────────────
    step('Checking Cloudflare authentication');
    const whoami = run('npx wrangler whoami', { silent: true, ignoreError: true });
    if (!whoami || whoami.includes('Not logged in') || whoami.includes('not authenticated')) {
        warn('Not logged into Cloudflare — opening login page');
        run('npx wrangler login', { silent: false });
    } else {
        success('Authenticated with Cloudflare');
    }

    console.log('');

    // ── 2. D1 Database ───────────────────────
    step('Configuring D1 Database');
    let dbId = '';
    try {
        const d1List = run('npx wrangler d1 list --json', { silent: true });
        const d1s = JSON.parse(d1List);
        const existing = d1s.find(d => d.name === 'flarestack-db');

        if (existing) {
            dbId = existing.uuid;
            success(`Found existing D1: flarestack-db`);
            kv('ID', dbId);
        } else {
            info('Creating new D1 database: flarestack-db');
            const created = run('npx wrangler d1 create flarestack-db', { silent: true });

            const match = created.match(/"database_id":\s*"([^"]+)"/);
            if (match) {
                dbId = match[1];
                success(`D1 database created`);
                kv('ID', dbId);
            } else {
                throw new Error("Could not parse D1 create output");
            }
        }
    } catch (e) {
        error('Failed to find or create D1 database');
        process.exit(1);
    }

    console.log('');

    // ── 3. Update Config Files ───────────────
    step('Updating wrangler config file with production D1 ID');

    const workerConfPath = path.join(__dirname, '../apps/worker/wrangler.jsonc');
    let workerConf = fs.readFileSync(workerConfPath, 'utf8');
    workerConf = workerConf.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${dbId}"`);
    fs.writeFileSync(workerConfPath, workerConf);
    success('apps/worker/wrangler.jsonc updated');

    console.log('');

    // ── 4. DB Migrations ─────────────────────
    const shouldReset = process.argv.includes('--reset-db');

    if (shouldReset) {
        warn('Resetting production database as requested...');
        const dropTables = [
            'account', 'session', 'user', 'verification', 
            'action_logs', 'add_ip_to_list_rules', 'cloudflare_accounts', 
            'zone_configs', 'entity_cache', 'd1_migrations'
        ];
        const dropCommand = `npx wrangler d1 execute flarestack-db --remote --command "${dropTables.map(t => `DROP TABLE IF EXISTS ${t}`).join('; ')};" --config apps/worker/wrangler.jsonc`;
        run(dropCommand);
        success('Production database wiped');
        console.log('');
    }

    step('Applying DB migrations to production');
    try {
        run('npx wrangler d1 migrations apply flarestack-db --remote --config apps/worker/wrangler.jsonc', { captureError: true });
        success('Migrations applied');
    } catch (err) {
        const stdout = err.stdout?.toString() || '';
        const stderr = err.stderr?.toString() || '';
        const output = stdout + stderr;

        if (output.includes('already exists')) {
            console.log('');
            console.log(`${C.bold}${C.red}${ICON.error} CONFLICT: Production database is out of sync with your local history.${C.reset}`);
            console.log(`${C.dim}──────────────────────────────────────────────────────────────────${C.reset}`);
            console.log(`${C.yellow}Why this happened:${C.reset}`);
            console.log(`You likely ran local database nuking, which wiped your local migration history.`);
            console.log(`However, your remote Cloudflare D1 database still has your old tables.`);
            console.log('');
            console.log(`${C.green}The Fix:${C.reset}`);
            console.log(`Run the deploy again with the ${C.bold}--reset-db${C.reset} flag to wipe production and start fresh:`);
            console.log(`${C.bold}${C.cyan}  pnpm run deploy-worker -- --reset-db${C.reset}`);
            console.log(`${C.dim}──────────────────────────────────────────────────────────────────${C.reset}\n`);
            process.exit(1);
        } else {
            error('Migration failed');
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
            process.exit(1);
        }
    }

    console.log('');

    // ── 5. Deploy Worker ─────────────────────
    step('Deploying Worker');
    run('pnpm --filter @flarestack/worker run deploy');
    success('Worker deployed');

    // ── Done ─────────────────────────────────
    console.log('');
    divider();
    console.log(`${C.bold}${C.green}✨ Worker deployment complete!${C.reset}`);
    console.log('');
    kv('D1 Database ID ', dbId);
    divider();
    console.log('');
}

deploy();
