"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { TooltipProvider } from "@myhoodora/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { OfflineBanner, ProblemState } from "@/components/shared/connection-states";
import { ComposerProvider } from "@/features/feed/composer-context";
import { hasSkippedOnboarding } from "@/features/onboarding/draft";
import { FirstRunTour } from "@/features/tour/first-run-tour";
import { ROUTES } from "@/lib/routes";
import { isStaff } from "@/lib/auth/profile";
import { AppHeader } from "./app-header";
import { AppSkeleton } from "./app-skeleton";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { useLogout } from "./user-menu";
import { UrgentAlertBanner } from "./urgent-alert-banner";
import { VerificationBanner } from "./verification-banner";
import { EmailVerificationBanner } from "./email-verification-banner";

const LOADING_TIMEOUT_MS = 8000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, profileStatus, profileError, loading, refreshProfile } = useAuth();
  const handleLogout = useLogout();
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [retrying, setRetrying] = useState(false);
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
  // Only a *loaded* profile can say they aren't onboarded — a failed load
  // is shown as an error below, never treated as a new account. Staff who
  // aren't residents browse with limited access instead, like "Skip for now".
  const needsOnboarding =
    !!user &&
    profileStatus === "ready" &&
    !!profile &&
    !profile.isOnboarded &&
    !isStaff(profile.role) &&
    !hasSkippedOnboarding(user.uid);
  useEffect(() => {
    if (!loading && needsOnboarding) router.replace(ROUTES.onboarding);
  }, [loading, needsOnboarding, router]);

  const waiting = loading || profileStatus === "loading";
  useEffect(() => {
    if (!waiting) {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTooLong(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const retryProfile = async () => {
    setRetrying(true);
    await refreshProfile();
    setRetrying(false);
  };

  if (!loading && user && profileStatus === "error") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md space-y-3">
          <ProblemState
            title="We couldn't load your account"
            message={profileError?.message ?? "Something went wrong. Please try again."}
            kind={profileError?.kind ?? null}
            onRetry={() => void retryProfile()}
            retrying={retrying}
          />
          <Button variant="ghost" className="w-full" onClick={() => void handleLogout()}>
            Log out
          </Button>
        </div>
      </div>
    );
  }

  if (waiting || !user || needsOnboarding) {
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
            <EmailVerificationBanner />
          </div>
          <div className="mx-auto flex max-w-[1280px] gap-6 px-4 lg:px-6">
            <AppSidebar />
            <main id="main" className="min-w-0 flex-1 pt-4 pb-24 sm:pt-6 lg:pb-10">
              {children}
            </main>
          </div>
          <MobileTabBar />
          <OnboardingGatingModal />
          <FirstRunTour />
        </div>
      </ComposerProvider>
    </TooltipProvider>
  );
}
