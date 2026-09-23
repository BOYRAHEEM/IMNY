import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { getStoreName } from "@/lib/queries/settings";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Dashboard · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side role check. The proxy only checks that someone is signed in.
  const user = await requireStaffPage();
  const storeName = await getStoreName();

  return (
    <AdminShell storeName={storeName} user={{ email: user.email, name: user.fullName, role: user.role }}>
      {children}
    </AdminShell>
  );
}
