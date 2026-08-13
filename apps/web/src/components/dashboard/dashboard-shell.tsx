"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { getActiveNavItem } from "./navigation";

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-100 bg-white p-4 lg:flex">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                <Skeleton className="size-[18px] shrink-0 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>

      {/* Main skeleton */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white px-4 sm:px-6">
          <Skeleton className="h-5 w-32" />
          <div className="ml-auto">
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full" />
            </div>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [navSuccess, setNavSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (navSuccess) {
      const timer = setTimeout(() => setNavSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [navSuccess]);

  if (loading || !user) {
    return <DashboardSkeleton />;
  }

  const title = getActiveNavItem(pathname)?.title ?? "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <DashboardSidebar onNavAction={setNavSuccess} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title={title} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            {navSuccess && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <span>{navSuccess}</span>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <OnboardingGatingModal />
    </div>
  );
}
