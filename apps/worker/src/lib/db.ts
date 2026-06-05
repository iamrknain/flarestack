import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@flarestack/db/src/schema/index';

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

    const data = await res.json() as any;
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
    if (statements.length > 0) {
      const first = statements[0];
      console.log("Statement class:", first?.constructor?.name);
      console.log("Statement keys:", Object.keys(first || {}));
      console.log("Statement prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(first || {})));
      if (typeof first.toSQL === 'function') {
        console.log("toSQL output:", first.toSQL());
      }
    }
    const payload = {
      batch: statements.map((stmt) => ({
        sql: stmt.sql,
        params: stmt.params || [],
      }))
    };
    const results = await this.executeQuery(payload);
    return results.map((res: any) => ({
      results: res.results || [],
      success: true,
      meta: res.meta || {},
    }));
  }
}

export function getWorkerDb(env: any) {
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_DATABASE_ID) {
    const httpClient = new CloudflareD1HttpClient(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_DATABASE_ID,
      env.CLOUDFLARE_API_TOKEN
    );
    return drizzle(httpClient as any, { schema });
  }
  return drizzle(env.DB, { schema });
}
