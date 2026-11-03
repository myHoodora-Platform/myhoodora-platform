"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";

/**
 * Client-side backstop for the proxy's "/ → /news-feed" redirect: when the
 * session cookie had expired the proxy can't tell the visitor is signed in,
 * but Firebase can. Waits for `sessionReady` (the cookie is back), not just
 * for Firebase to restore the user: redirecting any sooner races the cookie
 * and the proxy answers with the login page.
 */
export function RedirectIfSignedIn() {
  const router = useRouter();
  const { user, sessionReady } = useAuth();
  useEffect(() => {
    if (sessionReady && user) router.replace(DEFAULT_APP_ROUTE);
  }, [sessionReady, user, router]);
  return null;
}
