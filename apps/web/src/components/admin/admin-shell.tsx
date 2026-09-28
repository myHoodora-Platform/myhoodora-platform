"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppSkeleton } from "@/components/layout/app-shell/app-skeleton";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { getActiveNavItem } from "./admin-navigation";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";

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
      router.push(DEFAULT_APP_ROUTE);
    }
  }, [loading, user, profile, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return <AppSkeleton />;
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
