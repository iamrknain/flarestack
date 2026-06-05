# Vercel Log Drain — Analytics Pipeline

## Overview

Vercel does **not** expose a real-time traffic analytics API (unlike Cloudflare GraphQL).
To measure request volume per project, FlareStack uses **Vercel Log Drains** — Vercel POSTs
every request log to a webhook endpoint, which we aggregate into our Postgres database.

---

## Full Data Flow

```
User's Vercel Project
        │
        │  (every request: lambda, edge, static, etc.)
        ▼
POST /api/ingest/vercel          ← FlareStack webhook (src/app/api/ingest/vercel/route.ts)
        │
        │  1. Verify x-vercel-signature (HMAC-SHA1)
        │  2. Filter to request-only sources
        │  3. Aggregate by (projectId, minute)
        ▼
vercel_traffic_stats table        ← Postgres: composite PK (project_id, minute)
        │                            ON CONFLICT → increment request_count
        │
        │  (every N minutes, triggered by cron service)
        ▼
POST /api/cron/vercel             ← FlareStack cron endpoint (src/app/api/cron/vercel/route.ts)
        │
        │  runVercelCron(userId)  (src/cron/vercel/index.ts)
        │    → runVercelUnderAttackRule  (reads SUM from vercel_traffic_stats)
        │    → runVercelBotProtectionRule
        │    → prune stats older than 2h  ← TODO: under reconsideration
        ▼
Vercel API  POST /v1/security/attack-mode
            (enable or disable based on threshold logic)
```

---

## Ingest Endpoint

**`POST /api/ingest/vercel`**

| Detail | Value |
|--------|-------|
| Auth | `x-vercel-signature` header — HMAC-SHA1 of raw body using `VERCEL_LOG_DRAIN_SECRET` |
| Content-Type | `application/json` |
| Payload | JSON array of Vercel log entries |

### Request Sources Counted

Only these `source` values are counted as real traffic (build logs are ignored):

| source | Description |
|--------|-------------|
| `lambda` | Serverless function invocation |
| `edge` | Edge function invocation |
| `static` | Static asset served |
| `external` | Proxied external request |
| `firewall` | Request processed by WAF/firewall |
| `redirect` | Redirect response served |

### Aggregation

Logs are bucketed per `(projectId, minute)`:

```
minute = Math.floor(timestamp_ms / 60_000) * 60   // Unix seconds, minute-aligned
```

Multiple batches landing in the same minute window are atomically incremented via:

```sql
INSERT INTO vercel_traffic_stats (project_id, minute, request_count)
VALUES ($1, $2, $3)
ON CONFLICT (project_id, minute)
DO UPDATE SET
  request_count = vercel_traffic_stats.request_count + EXCLUDED.request_count,
  updated_at = NOW();
```

---

## Rule Decision Logic

### Under Attack Mode (`src/cron/vercel/underAttackMode.ts`)

```
totalRequests = SUM(request_count)
                FROM vercel_traffic_stats
                WHERE project_id = ? AND minute >= (now - windowSeconds)
```

| Condition | Action |
|-----------|--------|
| `totalRequests > rateLimitThreshold` AND attack mode OFF | Enable attack mode via Vercel API |
| `totalRequests < offThreshold` AND `autoOff=true` AND attack mode ON | Disable attack mode |
| Otherwise | No change (hysteresis zone) |

Vercel API call: `POST https://api.vercel.com/v1/security/attack-mode`

### Bot Protection (`src/cron/vercel/botProtection.ts`)

Same traffic query. Same threshold logic. Action differs — enables Vercel's bot protection
feature instead of full attack mode.

---

## Database Schema

```sql
-- vercel_traffic_stats
CREATE TABLE vercel_traffic_stats (
  project_id   VARCHAR(255) NOT NULL,
  minute       INTEGER      NOT NULL,   -- Unix epoch seconds, minute-aligned
  request_count INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP    NOT NULL,
  PRIMARY KEY (project_id, minute)
);
```

> **Note:** `project_id` here is the **Vercel internal project ID** (e.g. `prj_abc123`),
> which is what the Log Drain payload sends. This maps to `vercel_projects.vercel_project_id`
> (not the FlareStack internal UUID `vercel_projects.id`).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VERCEL_LOG_DRAIN_SECRET` | ✅ Yes | Secret set when creating the Log Drain on Vercel dashboard. Used to verify `x-vercel-signature`. |

---

## Setup Guide

### Step 1 — Generate a secret

```bash
openssl rand -hex 32
# e.g. a3f9d2c1...
```

Set it as `VERCEL_LOG_DRAIN_SECRET` in your `.env` / Vercel project settings.

### Step 2 — Create the Log Drain on Vercel

1. Go to **Vercel Dashboard → Team Settings → Log Drains**
2. Click **Add Drain**
3. Set:
   - **Endpoint**: `https://your-domain.com/api/ingest/vercel`
   - **Format**: `json`
   - **Sources**: Check `Lambda`, `Edge`, `Static`, `Build` (build is filtered out in code)
   - **Environment**: `Production` (and optionally Preview)
   - **Secret**: your generated secret above
4. Save → Vercel will verify the endpoint is reachable

### Step 3 — Set up the cron trigger

Configure your cron service (e.g. Vercel Cron, GitHub Actions, cron-job.org) to call:

```
POST https://your-domain.com/api/cron/vercel
Authorization: Bearer <your-jwt-token>
```

Generate the JWT from the FlareStack dashboard → Profile → **Cron Token Generator**.

Recommended frequency: **every 1–5 minutes**.

---

## Open Questions / TODO

### Stats Retention (marked `TODO: Needs Reconsideration`)

Currently, the cron prunes `vercel_traffic_stats` rows older than **2 hours** after each run.

**Arguments for keeping it:**
- Rules only ever look back at most `windowSeconds` (default 300s = 5min, max typically 3600s = 1hr)
- Without pruning, the table grows unbounded — every request generates a stat row
- 2h retention covers the longest reasonable `windowSeconds` with headroom

**Arguments for reconsidering:**
- You might want historical traffic data for the dashboard (graphs, trend analysis)
- Could prune to 24h or 7d for richer observability
- Could archive to a separate `vercel_traffic_history` table instead of deleting

**Recommended approach:** If you want dashboard graphs, change the cutoff to 7 days and add
a `vercel_traffic_stats` query to the dashboard data action. For raw security automation only,
2h is sufficient.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/app/api/ingest/vercel/route.ts` | Log Drain webhook — verifies, parses, upserts stats |
| `src/app/api/cron/vercel/route.ts` | Cron trigger endpoint — authenticates and runs engine |
| `src/cron/vercel/index.ts` | Cron orchestrator — loads rules, runs them, prunes stats |
| `src/cron/vercel/underAttackMode.ts` | Under Attack Mode rule logic |
| `src/cron/vercel/botProtection.ts` | Bot Protection rule logic |
| `src/cron/vercel/emails.ts` | Email templates for rule notifications |
| `src/db/schema/vercel.ts` | All Vercel table definitions including `vercelTrafficStats` |
