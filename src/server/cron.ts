"use server";

import { encryptSession } from "~/lib/auth";
import { getCurrentUser } from "~/lib/auth";

export async function generateCronToken(expiryDays: number): Promise<{ token: string } | { error: string }> {
    const user = await getCurrentUser();
    if (!user) return { error: "Not authenticated" };

    if (expiryDays < 1 || expiryDays > 365) {
        return { error: "Expiry must be between 1 and 365 days" };
    }

    const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
    const token = encryptSession({ userId: user.id, expiresAt });
    return { token };
}
