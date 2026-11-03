"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Store } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { claimBusinessPage } from "@/lib/api/business";
import { errorMessage } from "@/lib/api/client";
import { ROUTES } from "@/lib/routes";
import { GetStartedHeader } from "./get-started";

const KEY = "business-claim-token";
const readToken = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const writeToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private mode: the link just has to be opened again after signing in.
  }
};

/**
 * /business/claim?token=… — the link emailed when a Business Page is
 * approved. The token is moved out of the URL straight away and kept for
 * this tab, so it survives signing in or creating an account.
 */
export function ClaimPage() {
  const { user, authReady } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<{ status: "idle" | "claiming" } | { status: "done"; name: string } | { status: "failed"; message: string }>({ status: "idle" });

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      writeToken(fromUrl);
      window.history.replaceState(null, "", "/business/claim");
    }
    setToken(fromUrl ?? readToken());
  }, []);

  const claim = async () => {
    if (!user || !token) return;
    setState({ status: "claiming" });
    try {
      const res = await claimBusinessPage(user, token);
      writeToken(null);
      setState({ status: "done", name: res.businessName });
    } catch (err) {
      setState({ status: "failed", message: errorMessage(err, "This claim link is invalid or has expired.") });
    }
  };

  const card = (children: React.ReactNode) => (
    <div className="flex min-h-dvh flex-col bg-canvas font-sans text-foreground">
      <GetStartedHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">{children}</div>
      </main>
    </div>
  );

  if (state.status === "done") {
    return card(
      <>
        <BadgeCheck className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">{state.name} is yours</h1>
        <p className="text-sm text-muted-foreground">Your Business Page is now linked to your account. We&apos;ll let you know as page tools, Business Posts and Local Ads open up.</p>
        <Link href={ROUTES.newsFeed} className="block">
          <Button className="w-full">Go to myHoodora</Button>
        </Link>
      </>,
    );
  }

  if (!token) {
    return card(
      <>
        <Store className="mx-auto size-12 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">Open the link from your email</h1>
        <p className="text-sm text-muted-foreground">To claim your Business Page, open the “Claim my page” link we emailed when your page was approved.</p>
      </>,
    );
  }

  return card(
    <>
      <Store className="mx-auto size-12 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold">Claim your Business Page</h1>
      {!authReady ? (
        <p className="animate-pulse text-sm text-muted-foreground">Checking your account…</p>
      ) : user ? (
        <>
          <p className="text-sm text-muted-foreground">
            Link the page to <span className="font-semibold text-foreground">{user.email}</span>. You&apos;ll manage it from this account.
          </p>
          {state.status === "failed" && <p className="text-sm font-medium text-destructive">{state.message}</p>}
          <Button className="w-full" onClick={() => void claim()} disabled={state.status === "claiming"}>
            {state.status === "claiming" ? "Claiming…" : "Claim my page"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Sign in to your myHoodora account to claim your page.</p>
          <Link href={`${ROUTES.login}?next=/business/claim`} className="block">
            <Button className="w-full">Sign in to claim</Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            New to myHoodora?{" "}
            <Link href={ROUTES.register} className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
            , then open the link in your email again.
          </p>
        </>
      )}
    </>,
  );
}
