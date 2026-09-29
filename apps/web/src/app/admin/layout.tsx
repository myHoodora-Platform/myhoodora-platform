import { SidebarProvider } from "@myhoodora/ui/sidebar";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSessionProvider } from "@/features/admin/session";

// Filters live in the query string; render per request so the router cache
// never serves a list with stale filters (same fix as the (app) layout).
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSessionProvider>
        <AdminShell>{children}</AdminShell>
      </AdminSessionProvider>
    </SidebarProvider>
  );
}
