"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Guest-only pages (login, register, forgot password): someone who is
 * already signed in gets sent on into the app.
 *
 * The proxy does this on the server from the session cookie, but when the
 * cookie is missing or stale while Firebase still has a session, it lets
 * them through and they'd sit on a login form. AuthProvider refreshes the
 * cookie before `loading` clears, so redirecting after that is safe.
 *
 * Only the state on arrival counts: after they submit the form here, the
 * page does its own routing (e.g. to onboarding) and this stays out of it.
 */
export function useRedirectIfSignedIn() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || loading) return;
    checkedRef.current = true;
    if (user) {
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    }
  }, [user, loading, router]);
}
