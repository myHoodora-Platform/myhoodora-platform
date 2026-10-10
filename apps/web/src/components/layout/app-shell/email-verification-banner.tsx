"use client";

import { useState } from "react";
import { MailCheck, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { resendVerificationEmail } from "@/lib/api/account";
import { errorMessage } from "@/lib/api/client";
import { toast } from "sonner";

const DISMISS_KEY = "email-banner-dismissed";

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Asks someone to confirm their email address. Since October 2026 the API
 * requires it before posting or messaging (reading, reacting and RSVPs stay
 * open), so this is where an unconfirmed neighbour learns why "Post" is
 * refused and gets a new link. Hidden while the address banner shows so
 * neighbours never see two warnings stacked; dismissible per session.
 */
export function EmailVerificationBanner() {
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [sending, setSending] = useState(false);

  if (!user || !profile || profile.emailVerified !== false || dismissed) return null;
  if (profile.verificationStatus !== "verified") return null;

  const resend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail(user);
      toast.success(`New link sent to ${profile.email ?? user.email ?? "your email"}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send a new link."));
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: dismissal just won't persist.
    }
  };

  return (
    <div className="border-b border-primary/15 bg-primary/[0.05]">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5 lg:px-6">
        <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground">Confirm your email</span> to post and message your neighbours, and so
          safety alerts reach you. We sent a link to {profile.email ?? user.email}.
        </p>
        <Button size="sm" variant="outline" onClick={resend} disabled={sending} className="shrink-0">
          {sending ? "Sending…" : "Resend link"}
        </Button>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
