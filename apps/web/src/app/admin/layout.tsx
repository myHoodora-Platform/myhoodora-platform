import { SidebarProvider } from "@myhoodora/ui/sidebar";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSessionProvider } from "@/features/admin/session";

// Filters live in the query string; render per request so the router cache
// never serves a list with stale filters (same fix as the (app) layout).
export const dynamic = "force-dynamic";

// Staff-only: src/proxy.ts serves non-staff a 404 before this renders.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* Never indexed. (Not listed in robots.txt, which would advertise it.) */}
      <meta name="robots" content="noindex, nofollow" />
      <AdminSessionProvider>
        <AdminShell>{children}</AdminShell>
      </AdminSessionProvider>
    </SidebarProvider>
  );
}
