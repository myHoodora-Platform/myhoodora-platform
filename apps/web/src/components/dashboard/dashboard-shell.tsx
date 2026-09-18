"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { VerificationBanner } from "./verification-banner";
import { getActiveNavItem } from "./navigation";

const LOADING_TIMEOUT_MS = 8000;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, refreshProfile } = useAuth();
  const [navSuccess, setNavSuccess] = useState<string | null>(null);
  const [loadingTooLong, setLoadingTooLong] = useState(false);

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

  useEffect(() => {
    if (!loading) {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTooLong(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleRetry = () => {
    setLoadingTooLong(false);
    refreshProfile();
    router.refresh();
  };

  if (loading || !user) {
    if (loadingTooLong) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-800">
              This is taking longer than expected
            </p>
            <p className="text-sm text-muted-foreground">
              Your session may need refreshing.
            </p>
            <Button className="w-full" onClick={handleRetry}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return <DashboardSkeleton />;
  }

  const title = getActiveNavItem(pathname)?.title ?? "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <DashboardSidebar onNavAction={setNavSuccess} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title={title} />
        <VerificationBanner />

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
