import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "~/lib/auth";
import { DashboardLayout } from "~/components/DashboardLayout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const auth = getAuth();
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/auth?mode=login");
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
