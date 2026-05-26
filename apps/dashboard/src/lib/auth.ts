import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import * as schema from "@flarestack/db/src/schema/index";
import { sendVerificationEmail } from "./email";

export const getAuth = () => {
    const secret = process.env.BETTER_AUTH_SECRET;
    const baseURL = process.env.BETTER_AUTH_BASE_URL;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;

    if (!secret) {
        throw new Error("BETTER_AUTH_SECRET is not set — refusing to start with an insecure configuration.");
    }
    if (!baseURL) {
        throw new Error("BETTER_AUTH_BASE_URL is not set — email verification links and OAuth callbacks will be broken without it.");
    }

    const db = getDb();

    // Graceful degradation: only enable email verification if Resend is configured.
    const emailEnabled = !!(resendApiKey && resendApiKey.length > 0);

    return betterAuth({
        baseURL,
        secret,

        database: drizzleAdapter(db, {
            provider: "sqlite",
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
                rateLimit: schema.rateLimit
            }
        }),

        emailAndPassword: {
            enabled: true,
            requireEmailVerification: emailEnabled,
        },

        // Email verification — only wired up when Resend is configured.
        ...(emailEnabled && {
            emailVerification: {
                sendVerificationEmail: async ({ user, url }: { user: any; url: string }) => {
                    try {
                        const parsedUrl = new URL(url);
                        parsedUrl.searchParams.set("callbackURL", `${baseURL}/verify-email?verified=true`);
                        url = parsedUrl.toString();
                    } catch (e) {
                        // Fallback
                    }
                    await sendVerificationEmail(
                        { RESEND_API_KEY: resendApiKey, RESEND_FROM: resendFrom, BETTER_AUTH_BASE_URL: baseURL },
                        user.email,
                        url
                    );
                },
                sendOnSignUp: true,
                autoSignInAfterVerification: true,
            },
        }),

        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        if (!emailEnabled) {
                            return { data: { ...user, emailVerified: true } };
                        }
                        return { data: user };
                    }
                }
            }
        },

        // Rate limiting — standard settings
        rateLimit: {
            window: 60,
            max: 30,
            storage: "memory",
            customRules: {
                "/sign-in/email": { window: 60, max: 5 },
                "/sign-up/email": { window: 60, max: 3 },
                "/forget-password": { window: 60, max: 3 },
                "/send-verification-email": { window: 60, max: 3 },
                "/get-session": false,
            },
        },

        advanced: {
            ipAddress: {
                ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
            },
        },
    });
};
