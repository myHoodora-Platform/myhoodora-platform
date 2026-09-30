"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import Link from "next/link";
import { Hourglass, ShieldAlert } from "lucide-react";
import { ROUTES } from "@/lib/routes";

/**
 * Blocks its children behind address verification. Safety Watch, Community
 * Events, and Marketplace are neighbour-only spaces, so — unlike the feed's
 * soft nag via useRequireOnboarded — access is fully withheld (not just the
 * post/RSVP/list actions) until verificationStatus is "verified".
 */
export function VerifiedGate({ children }: { children: React.ReactNode }) {
  const { profile, setIsGatingModalOpen } = useAuth();

  if (!profile || profile.verificationStatus === "verified") {
    return <>{children}</>;
  }

  if (profile.verificationStatus === "pending_review") {
    const hoodName = profile.requestedHood?.name ?? "your neighbourhood";
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hourglass className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Waiting for approval to join {hoodName}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This part of myHoodora is only open to verified neighbours. It
            unlocks as soon as our team approves your request.
          </p>
        </div>
        <Link
          href={ROUTES.settingsNeighbourhood}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View your request
        </Link>
      </div>
    );
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
          This part of myHoodora is only open to verified neighbours. Confirm
          your address to unlock it.
        </p>
      </div>
      <Button onClick={() => setIsGatingModalOpen(true)}>
        Verify neighbourhood location
      </Button>
    </div>
  );
}
