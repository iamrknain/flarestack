import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import { drizzle } from "drizzle-orm/d1";
import * as schema from "@flarestack/db/src/schema/index";

// ── D1 Database HTTP Client for Production ───────────────────────────────────────
class CloudflareD1HttpClient {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;

  constructor(accountId: string, databaseId: string, apiToken: string) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
  }

  private async executeQuery(payload: any): Promise<any> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare D1 HTTP API returned error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(`Cloudflare D1 query failed: ${JSON.stringify(data.errors)}`);
    }

    return data.result;
  }

  prepare(sql: string) {
    const self = this;
    return {
      sql,
      params: [] as any[],
      bind(...params: any[]) {
        return {
          sql,
          params,
          async all() {
            const result = await self.executeQuery({ sql, params });
            return { results: result[0]?.results || [], success: true };
          },
          async run() {
            const result = await self.executeQuery({ sql, params });
            return { success: true, meta: result[0]?.meta || {} };
          },
          async values() {
            const result = await self.executeQuery({ sql, params });
            return (result[0]?.results || []).map((row: any) => Object.values(row));
          },
          async raw() {
            const result = await self.executeQuery({ sql, params });
            return (result[0]?.results || []).map((row: any) => Object.values(row));
          },
        };
      },
      async all() {
        const result = await self.executeQuery({ sql, params: [] });
        return { results: result[0]?.results || [], success: true };
      },
      async run() {
        const result = await self.executeQuery({ sql, params: [] });
        return { success: true, meta: result[0]?.meta || {} };
      },
      async values() {
        const result = await self.executeQuery({ sql, params: [] });
        return (result[0]?.results || []).map((row: any) => Object.values(row));
      },
      async raw() {
        const result = await self.executeQuery({ sql, params: [] });
        return (result[0]?.results || []).map((row: any) => Object.values(row));
      },
    };
  }

  async batch(statements: any[]) {
    const results = [];
    for (const stmt of statements) {
      const payload = {
        sql: stmt.sql,
        params: stmt.params || [],
      };
      const res = await this.executeQuery(payload);
      results.push(res[0]);
    }
    return results.map((res: any) => ({
      results: res?.results || [],
      success: true,
      meta: res?.meta || {},
    }));
  }
}

// ── LibSQL D1 Wrapper for Local Dev ──────────────────────────────────────────────
class LibSqlD1Wrapper {
  private client: any;

  constructor(dbPath: string) {
    const { createClient } = require("@libsql/client");
    this.client = createClient({ url: `file:${dbPath}` });
  }

  prepare(sql: string) {
    const self = this;
    return {
      bind(...params: any[]) {
        return {
          async all() {
            const res = await self.client.execute({ sql, args: params });
            return { results: res.rows, success: true };
          },
          async run() {
            const res = await self.client.execute({ sql, args: params });
            return { success: true, meta: {} };
          },
          async values() {
            const res = await self.client.execute({ sql, args: params });
            return res.rows.map((row: any) => Object.values(row));
          },
          async raw() {
            const res = await self.client.execute({ sql, args: params });
            return res.rows.map((row: any) => Object.values(row));
          },
        };
      },
      async all() {
        const res = await self.client.execute({ sql, args: [] });
        return { results: res.rows, success: true };
      },
      async run() {
        const res = await self.client.execute({ sql, args: [] });
        return { success: true, meta: {} };
      },
      async values() {
        const res = await self.client.execute({ sql, args: [] });
        return res.rows.map((row: any) => Object.values(row));
      },
      async raw() {
        const res = await self.client.execute({ sql, args: [] });
        return res.rows.map((row: any) => Object.values(row));
      },
    };
  }

  async batch(statements: any[]) {
    const res = await this.client.batch(
      statements.map((stmt) => ({
        sql: stmt.sql,
        args: stmt.params || [],
      }))
    );
    return res.map((r: any) => ({
      results: r.rows,
      success: true,
      meta: {},
    }));
  }
}

let dbInstance: any;

export function getDb() {
  if (dbInstance) return dbInstance;

  const isDev = process.env.NODE_ENV === "development";
  const localDbPath = process.env.LOCAL_DB_PATH;

  if (isDev && localDbPath) {
    const { join, dirname } = require("path");
    const { existsSync } = require("fs");
    const { fileURLToPath } = require("url");

    let absoluteDbPath = join(process.cwd(), localDbPath);
    if (!existsSync(absoluteDbPath)) {
      // Resolve relative to the current module file structure: src/lib/db.ts -> up two levels to get package root
      try {
        const currentFileDir = dirname(fileURLToPath(import.meta.url));
        const packageRoot = join(currentFileDir, "../..");
        const resolvedPath = join(packageRoot, localDbPath);
        if (existsSync(resolvedPath)) {
          absoluteDbPath = resolvedPath;
        }
      } catch (e) {
        // Fallback to absoluteDbPath
      }
    }
    const wrapper = new LibSqlD1Wrapper(absoluteDbPath);
    dbInstance = drizzle(wrapper as any, { schema });
    return dbInstance;
  }

  // Production: Cloudflare D1 HTTP client
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, or CLOUDFLARE_DATABASE_ID in production environment variables."
    );
  }

  const httpClient = new CloudflareD1HttpClient(accountId, databaseId, apiToken);
  dbInstance = drizzle(httpClient as any, { schema });
  return dbInstance;
}
