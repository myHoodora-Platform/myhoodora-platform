"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { routeAfterSignIn, signInWithApple, signInWithGoogle } from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";
import { enterApp } from "@/lib/safe-redirect";

/**
 * Which providers are offered, on every sign-in and sign-up screen at once.
 * Google is on. Apple is off until it is set up (an Apple Developer service
 * id + key, and the Apple provider enabled in Firebase): flip this to true
 * then, nothing else needs to change.
 */
export const GOOGLE_SIGN_IN_ENABLED = true;
export const APPLE_SIGN_IN_ENABLED = false;

/**
 * Finish any provider sign-in the same way: wait for the server session and
 * the profile, then go where this person belongs (onboarding for a new or
 * unfinished account, otherwise `fallback`). A closed pop-up is not an error.
 */
export async function finishProviderSignIn(signIn: () => Promise<User>, fallback: string): Promise<void> {
  try {
    const user = await signIn();
    enterApp(await routeAfterSignIn(user, fallback));
  } catch (err) {
    const { code, message, silent } = getAuthErrorMessage(err);
    if (process.env.NODE_ENV === "development" && code) console.warn(`[AuthError code]: ${code}`);
    if (!silent) toast.error(message);
  }
}

interface SocialAuthButtonsProps {
  /** Where to go afterwards (e.g. the page they were sent to log in for). Defaults to the feed. */
  next?: () => string;
}

/** "Continue with Google" (and Apple, when enabled). Used by login, register and the landing sign-up card. */
export function SocialAuthButtons({ next }: SocialAuthButtonsProps) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  if (!GOOGLE_SIGN_IN_ENABLED && !APPLE_SIGN_IN_ENABLED) return null;

  const run = (provider: "google" | "apple", signIn: () => Promise<User>) => async () => {
    setBusy(provider);
    await finishProviderSignIn(signIn, next?.() ?? DEFAULT_APP_ROUTE);
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      {GOOGLE_SIGN_IN_ENABLED && (
        <Button type="button" variant="outline" className="w-full gap-3" onClick={run("google", signInWithGoogle)} loading={busy === "google"} disabled={busy !== null}>
          <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      )}

      {APPLE_SIGN_IN_ENABLED && (
        <Button type="button" variant="outline" className="w-full gap-3" onClick={run("apple", signInWithApple)} loading={busy === "apple"} disabled={busy !== null}>
          <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden>
            <path d="M17.05 20.28c-.96 0-2.04-.6-3.23-.6-1.16 0-2.22.56-3.12.56-1.44 0-4.39-2.86-4.39-7.07 0-4.23 2.72-6.44 5.33-6.44 1.38 0 2.51.88 3.51.88 1 0 2.44-.94 3.97-.94 1.83 0 3.32.96 4.14 2.21-3.66 1.54-3.08 6.42.54 7.9-1.07 2.76-2.3 3.5-3.15 3.5zm-1.63-14.71c-.81 1.01-2.12 1.67-3.26 1.58-.16-1.18.42-2.49 1.29-3.41.9-.96 2.25-1.55 3.25-1.55.19 1.25-.47 2.37-1.28 3.38z" />
          </svg>
          Continue with Apple
        </Button>
      )}
    </div>
  );
}
