# FlareStack

FlareStack is a security automation platform for **Cloudflare** and **Vercel**. It monitors real-time traffic, automatically enforces WAF rules (IP blocklists, Under Attack Mode, Bot Protection), and sends alert notifications — all driven by a single self-contained Next.js application backed by PostgreSQL.

---

## Architecture

FlareStack is a **single Next.js application** — no separate workers, no edge runtimes, no monorepo packages. Everything lives in `src/`.

```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── cloudflare/    ← Cron trigger endpoint (JWT or cookie auth)
│   │   │   └── vercel/        ← Cron trigger endpoint
│   │   └── ingest/
│   │       └── vercel/        ← Log Drain webhook (HMAC-SHA1 verified)
│   ├── auth/                  ← Sign in / sign up pages
│   └── dashboard/
│       ├── cloudflare/        ← Cloudflare zone & rule management
│       └── vercel/            ← Vercel project & rule management
├── components/                ← All UI components
├── cron/
│   ├── cloudflare/            ← CF rule engines (addIpToList, underAttackMode)
│   └── vercel/                ← Vercel rule engines (underAttackMode, botProtection)
├── db/
│   └── schema/                ← Drizzle/Postgres table definitions
├── lib/                       ← Auth, email, logger, debug helpers
└── server/                    ← Next.js server actions (cloudflare.ts, vercel.ts)
```

---

## How It Works

### Cloudflare
The cron engine queries **Cloudflare's GraphQL Analytics API** directly for real-time traffic data — no ingestion pipeline needed.

```
POST /api/cron/cloudflare
  → runCloudflareCron(userId)
    → queries CF GraphQL for top IPs / zone traffic
    → applies rules (block IPs, toggle Under Attack Mode)
    → writes audit log
```

### Vercel
Vercel has no public analytics API, so traffic data is ingested via **Log Drains** — Vercel POSTs every request log to our webhook.

```
Vercel Log Drain → POST /api/ingest/vercel
  → verify x-vercel-signature (HMAC-SHA1)
  → aggregate into vercel_traffic_stats (per project, per minute)

POST /api/cron/vercel
  → runVercelCron(userId)
    → queries vercel_traffic_stats for recent totals
    → applies rules (toggle Attack Mode, Bot Protection)
    → writes audit log
```

See [`docs/vercel-log-drain.md`](docs/vercel-log-drain.md) for full setup details.

---

## ⚙️ Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase, Neon, local, etc.) |
| `AUTH_SECRET` | ✅ | Random secret for signing session JWTs — `openssl rand -hex 32` |
| `RESEND_API_KEY` | ✅ | [Resend](https://resend.com) API key for email notifications |
| `RESEND_FROM` | optional | From address (must be from a Resend-verified domain) |
| `NEXT_PUBLIC_APP_URL` | optional | Your public URL (used for email links) — defaults to `localhost:3000` |
| `VERCEL_LOG_DRAIN_SECRET` | optional | Required only if using Vercel Log Drain integration |

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Start the dev server
```bash
npm run dev
```

**Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🌐 Production Deployment

FlareStack deploys as a standard Next.js app — Vercel, Railway, Fly.io, or any Node.js host works.

### 1. Set environment variables on your host
All vars from the table above, with real production values.

### 2. Run migrations against production DB
```bash
DATABASE_URL=<prod-url> npm run db:migrate
```

### 3. Deploy
```bash
# Vercel
vercel deploy --prod

# or build manually
npm run build
npm start
```

### 4. Configure cron triggers
Point an external cron service (Vercel Cron, GitHub Actions, cron-job.org) at:

```
POST https://your-domain.com/api/cron/cloudflare
POST https://your-domain.com/api/cron/vercel
Authorization: Bearer <token>
```

Generate the bearer token from **Dashboard → Profile → Cron Token**.

Recommended frequency: **every 1–5 minutes**.

### 5. Set up Vercel Log Drain (Vercel integration only)
See [`docs/vercel-log-drain.md`](docs/vercel-log-drain.md) for the full setup guide.

---

## 🛠 CLI Commands

| Command | Action |
|:--------|:-------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint across the codebase |
| `npm run db:generate` | Generate Drizzle migration files after schema changes in `src/db/schema/` |
| `npm run db:migrate` | Apply pending migrations to the database (uses `DATABASE_URL`) |
| `npm run db:push` | Directly push schema changes to DB (bypass migration files) |
| `npm run db:clean` | **Wipe all data** — drops and recreates the public schema (prompts for confirmation) |
| `npm run simulate-traffic` | Run the traffic simulation script (local testing of cron rules) |
| `npx drizzle-kit studio` | Open Drizzle Studio — visual PostgreSQL browser |