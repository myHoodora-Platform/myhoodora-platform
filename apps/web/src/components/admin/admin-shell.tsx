"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { getActiveNavItem } from "./admin-navigation";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && profile && !isAdmin) {
      router.push("/dashboard");
    }
  }, [loading, user, profile, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return <DashboardSkeleton />;
  }

  const title = getActiveNavItem(pathname)?.title ?? "Admin";

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader title={title} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
