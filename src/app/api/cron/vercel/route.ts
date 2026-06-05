import { NextRequest, after } from "next/server";
import { decryptSession, COOKIE_NAME } from "~/lib/auth";
import { getDb } from "~/db";
import { user as userTable } from "~/db/schema/user";
import { eq } from "drizzle-orm";
import { runVercelCron } from "~/cron/vercel";

async function handleCron(req: NextRequest) {
    // 1. Extract token — supports Bearer header, session cookie, and query params
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
    const queryToken = req.nextUrl.searchParams.get(COOKIE_NAME);
    const token = bearerToken ?? cookieToken ?? queryToken ?? null;

    if (!token) {
        return Response.json({ error: "Unauthorized: no token provided" }, { status: 401 });
    }

    // 2. Verify token signature and expiry
    const payload = decryptSession(token);
    if (!payload) {
        return Response.json({ error: "Unauthorized: invalid or expired token" }, { status: 401 });
    }

    // 3. Confirm user still exists
    const db = getDb();
    const rows = await db.select({ id: userTable.id, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, payload.userId))
        .limit(1);

    if (rows.length === 0) {
        return Response.json({ error: "Unauthorized: user not found" }, { status: 401 });
    }

    // 4. Run Vercel cron engine
    const isAsync = req.nextUrl.searchParams.get("async") === "true";

    if (isAsync) {
        try {
            after(async () => {
                try {
                    await runVercelCron(rows[0].id);
                } catch (err: any) {
                    console.error("[api/cron/vercel] Background engine failure:", err);
                }
            });
            return Response.json({ success: true, user: rows[0].email, message: "Cron triggered in background" });
        } catch (err: any) {
            console.error("[api/cron/vercel] Failed to trigger:", err);
            return Response.json({ error: err.message || "Cron execution failed" }, { status: 500 });
        }
    } else {
        try {
            await runVercelCron(rows[0].id);
            return Response.json({ success: true, user: rows[0].email });
        } catch (err: any) {
            console.error("[api/cron/vercel] Engine failure:", err);
            return Response.json({ error: err.message || "Cron execution failed" }, { status: 500 });
        }
    }
}

export async function GET(req: NextRequest) {
    return handleCron(req);
}

export async function POST(req: NextRequest) {
    return handleCron(req);
}
