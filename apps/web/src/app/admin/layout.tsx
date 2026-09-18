import { SidebarProvider } from "@myhoodora/ui/sidebar";
import { AdminDataProvider } from "@/context/AdminDataContext";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AdminDataProvider>
        <AdminShell>{children}</AdminShell>
      </AdminDataProvider>
    </SidebarProvider>
  );
}
