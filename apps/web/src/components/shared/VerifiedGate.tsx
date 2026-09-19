"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Blocks its children behind address verification. Safety Watch, Community
 * Events, and Marketplace are neighbor-only spaces, so — unlike the feed's
 * soft nag via useRequireOnboarded — access is fully withheld (not just the
 * post/RSVP/list actions) until verificationStatus is "verified".
 */
export function VerifiedGate({ children }: { children: React.ReactNode }) {
  const { profile, setIsGatingModalOpen } = useAuth();

  if (!profile || profile.verificationStatus === "verified") {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <ShieldAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Verification required
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          This part of myHoodora is only open to verified neighbors. Confirm
          your address to unlock it.
        </p>
      </div>
      <Button onClick={() => setIsGatingModalOpen(true)}>
        Verify neighborhood location
      </Button>
    </div>
  );
}
