import { Resend } from "resend";

export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

/**
 * General-purpose email sender via Resend.
 * Reads RESEND_API_KEY and RESEND_FROM from process.env.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    const from = (process.env.RESEND_FROM || "FlareStack <onboarding@resend.dev>").trim();

    if (!apiKey) {
        console.warn("[FlareStack] RESEND_API_KEY is missing. Skipping email.");
        return;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
    });

    if (error) {
        console.error("[FlareStack] Failed to send email:", error);
        throw new Error(`Email delivery failed: ${error.message ?? JSON.stringify(error)}`);
    }
}
