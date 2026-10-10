"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { signInWithGoogleCredential } from "@/lib/firebase/auth";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";
import { GOOGLE_SIGN_IN_ENABLED, finishProviderSignIn } from "./social-auth-buttons";

/** The OAuth web client the Firebase project's Google provider uses. Public (it appears in every sign-in URL). */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
    context?: "signin" | "signup" | "use";
  }): void;
  prompt(): void;
  cancel(): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let loading: Promise<void> | null = null;
function loadGoogleIdentity(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Identity Services didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google's own "Continue as …" prompt (One Tap), for signed-out visitors who
 * are already signed in to Google in this browser. It is Google's UI, drawn
 * by the browser (FedCM) or Google's script: we only ask for it and receive
 * the result. The Google ID token it returns goes to Firebase, so it is the
 * same account and session as the "Continue with Google" button.
 *
 * Deliberately quiet: nothing shows for signed-in users or people with no
 * Google session; closing it is respected (Google backs off for a growing
 * period); and if the script is blocked, the page works as before.
 */
export function GoogleOneTap({ next }: { next?: () => string }) {
  const { user, authReady } = useAuth();

  useEffect(() => {
    if (!GOOGLE_SIGN_IN_ENABLED || !CLIENT_ID || !authReady || user) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then(() => {
        const google = window.google?.accounts.id;
        if (cancelled || !google) return;
        google.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => {
            if (credential) void finishProviderSignIn(() => signInWithGoogleCredential(credential), next?.() ?? DEFAULT_APP_ROUTE);
          },
          // They choose to continue; we never sign someone in without a click.
          auto_select: false,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true,
          itp_support: true,
          context: "signin",
        });
        google.prompt();
      })
      .catch(() => undefined); // Blocked or offline: the buttons and the email form still work.
    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [authReady, user, next]);

  return null;
}
