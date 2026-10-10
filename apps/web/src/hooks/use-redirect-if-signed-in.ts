"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Guest-only pages (login, register, forgot password): someone who is
 * already signed in gets sent on into the app.
 *
 * The proxy does this on the server from the session cookie. Being here
 * while Firebase has a user means that cookie is missing or stale (expired,
 * deleted, or this tab sat open past its lifetime), so put it back first and
 * only then navigate. Otherwise the proxy would send them straight back here.
 * If it can't be restored they stay on the form, which is the way to fix it.
 *
 * Only the state on arrival counts: after they submit the form here, the
 * page does its own routing (e.g. to onboarding) and this stays out of it.
 */
export function useRedirectIfSignedIn() {
  const { user, authReady, ensureSession } = useAuth();
  const checkedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (checkedRef.current || !authReady) return;
    checkedRef.current = true;
    if (!user) return;
    void ensureSession().then((ready) => {
      if (!ready || !mountedRef.current) return;
      // A full navigation, not router.replace(): they were usually bounced
      // here from the page they wanted, and the Next router remembers that
      // redirect and would replay it without asking the server again.
      window.location.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    });
  }, [user, authReady, ensureSession]);
}
