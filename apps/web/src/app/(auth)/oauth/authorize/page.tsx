"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { AUTHORIZE_PATH, authorizeParamsFrom, type AuthorizeParams } from "@myhoodora/api-contract/oauth";
import { useAuth } from "@/context/AuthContext";
import { resendVerificationEmail } from "@/lib/api/account";
import { ApiError, errorMessage } from "@/lib/api/client";
import { USE_MOCKS } from "@/lib/api/config";
import { authorizeForApp } from "@/lib/api/oauth";
import { rememberOAuthResume } from "@/lib/oauth/resume";
import { ROUTES } from "@/lib/routes";

type View = { kind: "working" } | { kind: "leaving" } | { kind: "email" } | { kind: "error"; message: string };

/**
 * /oauth/authorize: "Continue to myHoodora AI" (docs/integrations/myhoodora-ai.md §4.1). myHoodora AI
 * sends educators here; this page asks the API, which decides everything:
 * - back to the app with a code, or with an error (suspended, closed, cancelled…);
 * - or a step first: the age check, the current terms or "Welcome back" (this page remembers itself,
 *   and that page returns here afterwards: lib/oauth/resume.ts), or confirming their email (here).
 * No Hood or address is needed. Signed-out visitors are sent to log in first, by the proxy.
 */
export default function AuthorizePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<View>({ kind: "working" });
  const [resent, setResent] = useState(false);
  const started = useRef(false);
  // Read after mounting, like the login page, so the page stays statically rendered.
  const request = useRef<{ params: AuthorizeParams; here: string } | null>(null);

  const ask = useCallback(
    async (decision?: "cancel") => {
      if (!user || !request.current) return;
      setView({ kind: "working" });
      try {
        const outcome = await authorizeForApp(user, { ...request.current.params, ...(decision && { decision }) });
        if (outcome.kind === "redirect") {
          setView({ kind: "leaving" });
          // A full navigation to the app (another site): the address comes from our API, which only uses registered ones.
          window.location.assign(outcome.url);
          return;
        }
        if (outcome.step === "email") {
          setView({ kind: "email" });
          return;
        }
        rememberOAuthResume(request.current.here);
        router.replace(outcome.step === "age_check" ? ROUTES.confirmAge : outcome.step === "terms" ? ROUTES.acceptTerms : ROUTES.welcomeBack);
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        setView({
          kind: "error",
          message:
            status === 400
              ? "This sign-in link isn't valid. Go back to myHoodora AI and choose “Continue with myHoodora” again."
              : status === 404
                ? "Signing in to myHoodora AI with your myHoodora account isn't available yet."
                : errorMessage(err, "We couldn't continue to myHoodora AI. Please try again."),
        });
      }
    },
    [user, router],
  );

  useEffect(() => {
    if (loading || started.current) return;
    const search = new URLSearchParams(window.location.search);
    const here = `${AUTHORIZE_PATH}?${search.toString()}`;
    if (!user) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(here)}`);
      return;
    }
    started.current = true;
    if (USE_MOCKS) {
      setView({ kind: "error", message: "Signing in to myHoodora AI needs the real API; it isn't available in mock mode." });
      return;
    }
    request.current = { params: authorizeParamsFrom(search), here };
    void ask();
  }, [loading, user, router, ask]);

  if (view.kind === "error") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-bold">Couldn&apos;t continue to myHoodora AI</h1>
        <p className="text-sm text-muted-foreground">{view.message}</p>
        <Button variant="outline" className="w-full" onClick={() => router.replace(ROUTES.home)}>
          Go to myHoodora
        </Button>
      </div>
    );
  }

  if (view.kind === "email" && user) {
    return (
      <div className="space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-bold">Confirm your email first</h1>
          <p className="text-sm text-muted-foreground">
            myHoodora AI needs a confirmed email address. We sent a link to <span className="font-semibold text-foreground">{user.email}</span>. Open
            it, then come back here.
          </p>
        </div>
        <Button className="w-full" onClick={() => void ask()}>
          I&apos;ve confirmed it, continue
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={resent}
          onClick={() =>
            void resendVerificationEmail(user)
              .then(() => setResent(true))
              .catch((err) => setView({ kind: "error", message: errorMessage(err) }))
          }
        >
          {resent ? "Link sent: check your inbox" : "Send the link again"}
        </Button>
        <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <button type="button" onClick={() => void ask("cancel")} className="font-semibold underline hover:text-primary">
            Cancel and go back to myHoodora AI
          </button>
          {" · "}
          <button type="button" onClick={() => void logout().then(() => router.replace(ROUTES.login))} className="font-semibold underline hover:text-primary">
            Not you? Sign out
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center" aria-busy>
      <p className="text-sm font-medium">{view.kind === "leaving" ? "Taking you to myHoodora AI…" : "Continuing to myHoodora AI…"}</p>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
