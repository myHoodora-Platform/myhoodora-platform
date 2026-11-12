"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { AgeCheckForm, CantJoinYet } from "@/features/age/age-check-form";
import { ageCheckLocked, lockAgeCheck } from "@/features/age/age-lock";
import { isStaff, needsAgeCheck } from "@/lib/auth/profile";
import { DEFAULT_APP_ROUTE, ROUTES } from "@/lib/routes";
import { takeOAuthResume } from "@/lib/oauth/resume";

/**
 * /confirm-age: the age check, before onboarding, for everyone however they signed up
 * (docs/compliance/ndpa.md §1). The app shell and onboarding send people here until it's passed.
 */
export default function ConfirmAgePage() {
  const router = useRouter();
  const { user, profile, profileStatus, loading, confirmAge, logout } = useAuth();
  // Read after mount: the server render can't see this browser's storage.
  const [blocked, setBlocked] = useState<boolean | null>(null);
  useEffect(() => setBlocked(ageCheckLocked()), []);

  // Turned away just now, or someone on this browser was recently: no second try with another year.
  // Signs out whoever is here (a closed account, or anyone else's, which stays untouched).
  const signingOut = useRef(false);
  useEffect(() => {
    if (!blocked || !user || signingOut.current) return;
    signingOut.current = true;
    void logout().finally(() => (signingOut.current = false));
  }, [blocked, user, logout]);

  useEffect(() => {
    if (blocked !== false || loading) return;
    if (!user) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.confirmAge)}`);
    } else if (profileStatus === "ready" && profile && !needsAgeCheck(profile)) {
      // Back to "Continue to myHoodora AI" if that's what sent them here (lib/oauth/resume.ts).
      router.replace(takeOAuthResume() ?? (profile.isOnboarded || isStaff(profile.role) ? DEFAULT_APP_ROUTE : ROUTES.onboarding));
    }
  }, [blocked, loading, user, profile, profileStatus, router]);

  if (blocked) return <CantJoinYet />;
  if (blocked === null || loading || !user || profileStatus !== "ready" || !needsAgeCheck(profile)) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="mx-auto size-12 rounded-full" />
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const submit = async (birthDate: string) => {
    const adult = await confirmAge(birthDate);
    if (!adult) {
      lockAgeCheck();
      setBlocked(true);
    }
    return adult;
  };

  return (
    <div className="space-y-6">
      <AgeCheckForm onSubmit={submit} />
      <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Signed in as <span className="font-semibold text-foreground">{user.email}</span>.{" "}
        <button type="button" onClick={() => void logout().then(() => router.replace(ROUTES.login))} className="font-semibold underline hover:text-primary">
          Not you? Sign out
        </button>
      </p>
    </div>
  );
}
