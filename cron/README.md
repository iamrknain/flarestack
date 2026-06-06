# FlareStack Cron System Documentation

FlareStack's rate-limiting rules are evaluated and enforced periodically by triggering the background cron engines. This directory contains the standalone background runner and explains the API endpoints that power it.

---

## ❖ API Endpoints

FlareStack exposes two HTTP endpoints to run the mitigation checks:

* **Cloudflare Cron:** `/api/cron/cloudflare`
  * Evaluates zone request rates, updates IP list rules, and manages Custom WAF toggling.
* **Vercel Cron:** `/api/cron/vercel`
  * Syncs and checks Vercel firewall status and handles automated Vercel mitigations.

Both endpoints support **GET** and **POST** requests.

---

## 🗝 Authentication

To authenticate with the cron API, you must provide a valid user token (the signature is verified against your application's session key). The API reads the token from three places (in priority order):

1. **Authorization Header:** (Recommended for automated scripts/external crons)
   ```http
   Authorization: Bearer <your_session_token>
   ```
2. **Cookie:**
   ```http
   Cookie: flarestack_token=<your_session_token>
   ```
3. **Query Parameter:**
   ```http
   GET /api/cron/cloudflare?flarestack_token=<your_session_token>
   ```

---

## ⧗ Execution Modes

### 1. Synchronous (Default)
By default, triggering the API path will block and wait for the entire checking process to finish before returning a response.
* **Request:** `/api/cron/cloudflare`
* **Response:** `{ "success": true, "user": "user@example.com" }`

### 2. Asynchronous (Recommended for high frequency)
Append `?async=true` to process the engine in the background using Next.js's non-blocking `after()` pipeline. The API returns an immediate `200 OK` response while the checks run.
* **Request:** `/api/cron/cloudflare?async=true`
* **Response:** `{ "success": true, "user": "user@example.com", "message": "Cron triggered in background" }`

---

## ⚙ Running the Local Cron Worker

A standalone CLI background worker is provided at `cron/worker.ts` to trigger these endpoints automatically.

### Configuration
1. Make sure `CRON_API_TOKEN` is set in your `.env` file at the root of the project. This is the token that will be sent in the `Authorization` header.
2. Run the start command:
   ```bash
   pnpm run cron-worker
   ```

### Command Options
The script accepts optional overrides:
* `--url=<base_url>`: Target specific environments (default: `http://localhost:3000`).
* `--interval=<seconds>`: Customize the polling interval in seconds (default: `10`).

#### Examples:
* **Custom Interval (30s):**
  ```bash
  pnpm run cron-worker --interval=30
  ```
* **Targeting Production:**
  ```bash
  pnpm run cron-worker --url=https://flarestack.yourdomain.com --interval=10
  ```

---

## ☁ Production Deployment Options

In production, you can trigger these endpoints using any cron service:

### 1. Vercel Crons (`vercel.json`)
If deploying on Vercel, define a cron schedule:
```json
{
  "crons": [
    {
      "path": "/api/cron/cloudflare?async=true",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/vercel?async=true",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

### 2. Server Crontab (Linux)
Set up a simple bash script or crontab executing `curl`:
```bash
* * * * * curl -X POST -H "Authorization: Bearer <your_session_token>" https://yourdomain.com/api/cron/cloudflare?async=true >/dev/null 2>&1
```
