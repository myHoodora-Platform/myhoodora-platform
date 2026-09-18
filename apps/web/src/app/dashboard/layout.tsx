import { SidebarProvider } from "@myhoodora/ui/sidebar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FeedProvider } from "@/context/FeedContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <FeedProvider>
        <DashboardShell>{children}</DashboardShell>
      </FeedProvider>
    </SidebarProvider>
  );
}
