"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailWarning } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { confirmEmail, resendVerificationEmail } from "@/lib/api/account";
import { errorMessage } from "@/lib/api/client";
import { toast } from "sonner";

type State = { status: "checking" } | { status: "done" } | { status: "failed"; message: string };

function VerifyEmail() {
  const params = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<State>({ status: "checking" });
  const [resending, setResending] = useState(false);
  // Tokens are single use: StrictMode's double effect must not send it twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const token = params.get("token");
    // Drop the token from the address bar and history straight away.
    window.history.replaceState(null, "", "/verify-email");
    if (!token) {
      setState({ status: "failed", message: "This link is incomplete. Open the latest email from us, or request a new link." });
      return;
    }
    confirmEmail(token)
      .then(() => setState({ status: "done" }))
      .catch((err) => setState({ status: "failed", message: errorMessage(err, "This link is invalid or has expired.") }));
  }, [params]);

  // Once confirmed, refresh the signed-in profile so the reminder banner goes away.
  useEffect(() => {
    if (state.status === "done" && user) void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, user]);

  const resend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await resendVerificationEmail(user);
      toast.success(`We've sent a new link to ${user.email ?? "your email"}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send a new link."));
    } finally {
      setResending(false);
    }
  };

  if (state.status === "checking") {
    return (
      <div className="space-y-2 py-6 text-center" role="status">
        <p className="animate-pulse text-sm text-muted-foreground">Confirming your email…</p>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email confirmed</h1>
          <p className="text-sm text-muted-foreground">Thanks! We’ll use this address for safety alerts and account notices.</p>
        </div>
        <Link href={user ? "/news-feed" : "/login"} className="block">
          <Button className="w-full">{user ? "Back to your neighbourhood" : "Sign in"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <MailWarning className="mx-auto size-12 text-warning" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">We couldn’t confirm your email</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
      </div>
      {user ? (
        <Button className="w-full" onClick={resend} disabled={resending}>
          {resending ? "Sending…" : "Send me a new link"}
        </Button>
      ) : (
        <Link href="/login" className="block">
          <Button className="w-full">Sign in to get a new link</Button>
        </Link>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
