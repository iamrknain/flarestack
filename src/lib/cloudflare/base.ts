export class CloudflareApiBase {
    constructor(
        protected readonly cfAccountId: string,
        protected readonly cfApiToken: string
    ) { }

    /**
     * Raw GraphQL wrapper. Throws on network or API-level errors.
     */
    protected async fetchGraphQL<T = unknown>(
        query: string,
        variables: Record<string, any> = {}
    ): Promise<T> {
        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.cfApiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!res.ok) {
            const detail = await res.text();
            throw new Error(`Cloudflare GraphQL Error (${res.status}): ${detail}`);
        }

        const payload: any = await res.json();
        if (payload.errors) {
            throw new Error(`Cloudflare GraphQL Error: ${JSON.stringify(payload.errors)}`);
        }

        return payload.data;
    }

    /**
     * Simple REST wrapper (returns payload.result).
     */
    protected async fetchRest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const payload = await this.fetchRestFull<T>(endpoint, options);
        return payload.result;
    }

    /**
     * Full REST wrapper (returns success, result, result_info, errors).
     *
     * Fix: reads the body as text first, then parses as JSON, so we never
     * double-consume the Response body on error paths.
     */
    protected async fetchRestFull<T = unknown>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<{
        success: boolean;
        result: T;
        result_info?: {
            cursors?: {
                after: string;
                before: string;
            };
            per_page: number;
            total_pages: number;
            total_count: number;
        };
        errors: any[];
    }> {
        const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.cfApiToken}`,
            },
        });

        // Read body as text ONCE — avoids double-consumption when .json()
        // throws and we fall back to .text() (the original bug).
        const text = await response.text();

        if (!response.ok) {
            let detail: string;
            try {
                const err = JSON.parse(text);
                detail = JSON.stringify(err.errors ?? err);
            } catch {
                detail = text;
            }
            throw new Error(`Cloudflare REST API Error (${response.status}): ${detail}`);
        }

        const payload: any = JSON.parse(text);

        if (!payload.success) {
            throw new Error(`Cloudflare REST API Error: ${JSON.stringify(payload.errors)}`);
        }

        return payload;
    }
}
