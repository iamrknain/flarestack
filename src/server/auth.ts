"use server";

import { cookies, headers } from "next/headers";
import { getDb } from "~/db";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { 
  verifyPassword, 
  hashPassword, 
  createSession, 
  COOKIE_NAME, 
  SESSION_EXPIRY_MS,
  getSession 
} from "~/lib/auth";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const db = getDb();
    const [existingUser] = await db.select().from(userTable).where(eq(userTable.email, email.toLowerCase())).limit(1);
    if (!existingUser) {
      return { error: "Invalid email or password." };
    }

    const isMatch = await verifyPassword(password, existingUser.passwordHash);
    if (!isMatch) {
      return { error: "Invalid email or password." };
    }

    const token = await createSession(existingUser.id);
    const nextCookies = await cookies();
    nextCookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: "/",
    });

    return { 
      success: true, 
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
      } 
    };
  } catch (error: any) {
    return { error: error.message || "Login failed." };
  }
}

export async function registerAction(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }

  try {
    const db = getDb();
    const [existingUser] = await db.select().from(userTable).where(eq(userTable.email, email.toLowerCase())).limit(1);
    if (existingUser) {
      return { error: "A user with this email already exists." };
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(userTable).values({
      id: userId,
      name,
      email: email.toLowerCase(),
      emailVerified: true,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await createSession(userId);
    const nextCookies = await cookies();
    nextCookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: "/",
    });

    return { 
      success: true, 
      user: {
        id: userId,
        name,
        email,
      } 
    };
  } catch (error: any) {
    return { error: error.message || "Registration failed." };
  }
}

export async function logoutAction() {
  try {
    const nextCookies = await cookies();
    nextCookies.delete(COOKIE_NAME);
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Logout failed." };
  }
}

export async function getCurrentUserAction() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  return { success: true, user: sessionData.user };
}

export async function updateProfileAction(formData: FormData) {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  if (!sessionData?.user) {
    return { error: "Unauthorized" };
  }
  const name = formData.get("name") as string;
  if (!name) {
    return { error: "Name is required" };
  }
  try {
    const db = getDb();
    await db.update(userTable).set({ name, updatedAt: new Date() }).where(eq(userTable.id, sessionData.user.id));
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update profile" };
  }
}
