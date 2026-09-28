"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { TooltipProvider } from "@myhoodora/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { OfflineBanner } from "@/components/shared/connection-states";
import { ComposerProvider } from "@/features/feed/composer-context";
import { hasSkippedOnboarding } from "@/features/onboarding/draft";
import { ROUTES } from "@/lib/routes";
import { AppHeader } from "./app-header";
import { AppSkeleton } from "./app-skeleton";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { UrgentAlertBanner } from "./urgent-alert-banner";
import { VerificationBanner } from "./verification-banner";

const LOADING_TIMEOUT_MS = 8000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  // Full-height screens (chat) size themselves with --banners-h, since the
  // urgent/verification banners come and go. A ref callback (not an effect)
  // so it attaches when the banners mount, after the loading skeleton.
  const bannersRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--banners-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--banners-h");
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      const next = pathname === ROUTES.newsFeed ? "" : `?next=${encodeURIComponent(pathname)}`;
      router.push(`${ROUTES.login}${next}`);
    }
  }, [user, loading, router, pathname]);

  // Nextdoor-style: finish onboarding before the app, unless they chose
  // "Skip for now" (limited access; the feed and gates nudge them back).
  const needsOnboarding = !!user && !!profile && !profile.isOnboarded && !hasSkippedOnboarding(user.uid);
  useEffect(() => {
    if (!loading && needsOnboarding) router.replace(ROUTES.onboarding);
  }, [loading, needsOnboarding, router]);

  useEffect(() => {
    if (!loading) {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTooLong(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading || !user || needsOnboarding) {
    if (loadingTooLong && !needsOnboarding) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-6">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-bold">This is taking longer than expected</p>
            <p className="text-sm text-muted-foreground">Your session may need refreshing.</p>
            <Button
              className="w-full"
              onClick={() => {
                setLoadingTooLong(false);
                void refreshProfile();
                router.refresh();
              }}
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return <AppSkeleton />;
  }

  return (
    <TooltipProvider>
      <ComposerProvider>
        <div className="min-h-screen bg-canvas">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:font-semibold"
          >
            Skip to content
          </a>
          <AppHeader />
          <div ref={bannersRef}>
            <OfflineBanner />
            <UrgentAlertBanner />
            <VerificationBanner />
          </div>
          <div className="mx-auto flex max-w-[1280px] gap-6 px-4 lg:px-6">
            <AppSidebar />
            <main id="main" className="min-w-0 flex-1 pt-4 pb-24 sm:pt-6 lg:pb-10">
              {children}
            </main>
          </div>
          <MobileTabBar />
          <OnboardingGatingModal />
        </div>
      </ComposerProvider>
    </TooltipProvider>
  );
}
