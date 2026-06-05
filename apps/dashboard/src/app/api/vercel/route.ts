import { getDb } from "~/lib/db";
import { getAuth } from "~/lib/auth";
import { vercelAccounts } from "@flarestack/db/src/schema/vercel";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
    const db = getDb();
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: request.headers });
    if (!sessionData?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const userId = sessionData.user.id;
    const formData = await request.formData();
    const accountRef = formData.get("accountRef") as string;
    const type = formData.get("type") as string;

    if (!accountRef) return Response.json({ error: "Missing accountRef" }, { status: 400 });

    const [account] = await db.select().from(vercelAccounts).where(
        and(eq(vercelAccounts.id, accountRef), eq(vercelAccounts.userId, userId))
    );
    if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

    try {
        if (type === "projects") {
            const url = account.vercelTeamId
                ? `https://api.vercel.com/v9/projects?teamId=${account.vercelTeamId}`
                : "https://api.vercel.com/v9/projects";

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${account.vercelToken}`,
                },
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Vercel API returned HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();
            const projects = (data.projects || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                domain: p.targets?.production?.domain || (p.alias?.[0] || ""),
            }));

            return Response.json(projects);
        }

        return Response.json({ error: "Invalid type for POST. Supported: projects" }, { status: 400 });
    } catch (err) {
        console.error("Vercel API Action Error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ error: msg || "Failed to process Vercel action" }, { status: 500 });
    }
}
