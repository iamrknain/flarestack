export class VercelApiBase {
    constructor(
        protected readonly vercelToken: string,
        protected readonly vercelTeamId?: string | null
    ) { }

    protected get teamParam(): string {
        return this.vercelTeamId ? `?teamId=${this.vercelTeamId}` : "";
    }

    protected get teamParamAmp(): string {
        return this.vercelTeamId ? `&teamId=${this.vercelTeamId}` : "";
    }

    protected async fetchVercel<T = unknown>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `https://api.vercel.com${endpoint}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${this.vercelToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            const detail = await res.text();
            throw new Error(`Vercel API Error (${res.status}): ${detail}`);
        }

        const text = await res.text();
        return text ? JSON.parse(text) : ({} as T);
    }
}
