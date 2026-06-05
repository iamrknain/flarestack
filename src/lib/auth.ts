import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "~/db";
import { user as userTable } from "~/db/schema/user";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "flarestack_token";
export const SESSION_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function signPayload(payload: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyPayload(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return payload;
  }
  return null;
}

export function encryptSession(payload: SessionPayload): string {
  const secret = process.env.AUTH_SECRET || "default-fallback-secret-key-32-chars-for-hmac-signatures-only";
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr).toString("base64url");
  return signPayload(base64, secret);
}

export function decryptSession(token: string): SessionPayload | null {
  const secret = process.env.AUTH_SECRET || "default-fallback-secret-key-32-chars-for-hmac-signatures-only";
  const base64 = verifyPayload(token, secret);
  if (!base64) return null;
  try {
    const jsonStr = Buffer.from(base64, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as SessionPayload;
    if (payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;
  return encryptSession({ userId, expiresAt });
}

export async function deleteSession(): Promise<void> {
  // Stateless sessions are cleared on the client side by deleting the cookie.
}

export async function getSession(cookieHeader?: string) {
  const db = getDb();
  let token: string | undefined;

  if (cookieHeader) {
    const cookiesList = cookieHeader.split(";");
    for (const cookie of cookiesList) {
      const [name, val] = cookie.trim().split("=");
      if (name === COOKIE_NAME) {
        token = val;
        break;
      }
    }
  } else {
    try {
      const nextCookies = await cookies();
      token = nextCookies.get(COOKIE_NAME)?.value;
    } catch {
      // Cookies not available outside of request context
    }
  }

  if (!token) return null;

  const payload = decryptSession(token);
  if (!payload) return null;

  const result = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, payload.userId))
    .limit(1);

  if (result.length === 0) return null;

  return {
    user: result[0],
    session: {
      expiresAt: new Date(payload.expiresAt),
    },
  };
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const sessionData = await getSession();
  return (sessionData?.user as AuthenticatedUser) || null;
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const sessionData = await getSession();
  if (!sessionData || !sessionData.user) {
    redirect("/login");
  }
  return sessionData.user as AuthenticatedUser;
}

export async function logout(): Promise<never> {
  try {
    const nextCookies = await cookies();
    nextCookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  } catch {
    // Cookies not available outside of request context
  }
  redirect("/login");
}
