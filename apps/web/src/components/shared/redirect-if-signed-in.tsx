"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";

/**
 * Client-side backstop for the proxy's "/ → /news-feed" redirect: when the
 * session cookie had expired (Firebase ID tokens last an hour) the proxy
 * can't tell the visitor is signed in, but Firebase can once it refreshes.
 */
export function RedirectIfSignedIn() {
  const router = useRouter();
  const { user, authReady } = useAuth();
  useEffect(() => {
    if (authReady && user) router.replace(DEFAULT_APP_ROUTE);
  }, [authReady, user, router]);
  return null;
}
