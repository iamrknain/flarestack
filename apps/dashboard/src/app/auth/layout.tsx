import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Authentication",
    description: "Sign in or register to manage your FlareStack edge-native IP blocklists and security rules.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
