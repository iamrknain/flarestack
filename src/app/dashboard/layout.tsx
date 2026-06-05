import { requireAuth } from "~/lib/auth";
import { DashboardLayout } from "~/components/DashboardLayout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
