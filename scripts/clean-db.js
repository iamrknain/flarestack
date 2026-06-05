#!/usr/bin/env node
// scripts/clean-db.js
// Drops and recreates the public schema — wipes ALL tables and data.
// Requires DATABASE_URL in .env or environment.
// Usage: npm run db:clean

const fs   = require("fs");
const path = require("path");
const readline = require("readline");

const RESET  = "\x1b[0m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

// ── Load DATABASE_URL ─────────────────────────────────────────────────────────

function loadEnv() {
    const envPath = path.resolve(__dirname, "../.env");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*([\w]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim();
        }
    }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error(`\n${RED}✖  DATABASE_URL is not set. Add it to .env or export it before running.${RESET}\n`);
    process.exit(1);
}

// ── Confirmation prompt ───────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log(`\n${BOLD}${RED}FlareStack — DB Clean${RESET}`);
console.log(`${YELLOW}${BOLD}⚠  WARNING: This will DROP ALL TABLES and DELETE ALL DATA.${RESET}`);
console.log(`${DIM}Target: ${dbUrl.replace(/:([^:@]+)@/, ":***@")}${RESET}\n`);  // hide password

rl.question(`  Type ${BOLD}yes${RESET} to confirm: `, async (answer) => {
    rl.close();

    if (answer.trim().toLowerCase() !== "yes") {
        console.log(`\n  ${YELLOW}Aborted.${RESET}\n`);
        process.exit(0);
    }

    console.log(`\n  Connecting to database...`);

    // ── Drop & recreate public schema ─────────────────────────────────────────
    // Uses the postgres package already in the project.
    let sql;
    try {
        const postgres = require("postgres");
        sql = postgres(dbUrl, { max: 1 });

        await sql`DROP SCHEMA public CASCADE`;
        await sql`CREATE SCHEMA public`;
        await sql`GRANT ALL ON SCHEMA public TO public`;

        console.log(`  ${GREEN}${BOLD}✔  All tables dropped. Schema recreated clean.${RESET}`);
    } catch (err) {
        console.error(`\n  ${RED}✖  Database error: ${err.message}${RESET}\n`);
        process.exit(1);
    } finally {
        if (sql) await sql.end();
    }

    console.log(`\n${GREEN}${BOLD}Done.${RESET} Run the following to restore the schema:\n`);
    console.log(`  ${BOLD}npm run db:migrate${RESET}   ← recreate all tables from migration files\n`);
});
