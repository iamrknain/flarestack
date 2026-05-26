# FlareStack Dashboard 🖥️

This is the Next.js administration portal for managing FlareStack edge reputation lists, viewing traffic telemetry, and managing user settings.

## 🚀 Getting Started

Ensure you have run the root setup script `pnpm run setup` to prepare the database before running.

Start the dashboard locally:
```bash
pnpm run dev
```

The portal will be running at [http://localhost:3000](http://localhost:3000).

## 🔑 Environment Variables (`.env`)

Copy the template from `.env.example` to `.env` and fill in the values:

*   **`BETTER_AUTH_BASE_URL`**: URL of your application (e.g. `http://localhost:3000` in dev).
*   **`BETTER_AUTH_SECRET`**: Random encryption secret for session signing (generated automatically via `pnpm run setup`).
*   **`LOCAL_DB_PATH`**: Path pointing to the active wrangler D1 SQLite file (`../../.wrangler/...`).
*   **`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_DATABASE_ID`**: Production credentials to query D1 database from Vercel edge/serverless environments.
*   **`RESEND_API_KEY` / `RESEND_FROM`**: Optional email delivery credentials to activate account verification.

## 🛠 Available Scripts

*   `pnpm run dev`: Starts the Next.js dev server.
*   `pnpm run build`: Compiles optimized production bundle.
*   `pnpm run start`: Starts production Node server.
*   `pnpm run typecheck`: Validates TypeScript.
