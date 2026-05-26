import type { Metadata } from "next";
import VerifyEmailClient from "./VerifyEmailClient";

export const metadata: Metadata = {
    title: "Verify Email",
    description: "Verify your email address to activate your FlareStack account.",
};

export default async function VerifyEmailPage() {
    const emailEnabled = !!process.env.RESEND_API_KEY;
    return <VerifyEmailClient emailEnabled={emailEnabled} />;
}
