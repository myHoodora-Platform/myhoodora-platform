"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppSkeleton } from "@/components/layout/app-shell/app-skeleton";
import { useAdminSession } from "@/features/admin/session";
import { getOverview } from "@/lib/api/admin/platform";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import type { AdminOverview } from "@/lib/api/admin/types";
import { errorKind } from "@/lib/api/client";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { AdminProblem, Unauthorized } from "./admin-states";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { session, loading: sessionLoading, error, reload } = useAdminSession();
  const [attention, setAttention] = useState<AdminOverview["attention"] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, loading, router, pathname]);

  // Sidebar work counts: refresh on navigation, when reports or support
  // messages arrive (live), and whenever preview data changes.
  const refreshCounts = useCallback(() => {
    if (!user || !session) return;
    getOverview(user)
      .then((o) => setAttention(o.attention))
      .catch(() => undefined);
  }, [user, session]);
  useEffect(refreshCounts, [refreshCounts, pathname]);
  const liveCounts = useLiveVersion(["queue.changed", "inbox.updated"]);
  useEffect(refreshCounts, [refreshCounts, liveCounts]);

  if (loading || !user || (sessionLoading && !session)) return <AppSkeleton />;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md">
          {errorKind(error) === "forbidden" ? (
            <Unauthorized message="The admin is only for myHoodora staff. If you should have access, ask an admin to add you to the team." />
          ) : (
            <AdminProblem error={error} onRetry={reload} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <AdminSidebar attention={attention} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
