"use client";

import { useRouter } from "next/navigation";
import { Hourglass, ShieldAlert } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";

export function VerificationBanner() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile || profile.verificationStatus === "verified") return null;

  // Asked to join a nearby Hood; staff are reviewing it. Nothing to fix,
  // so no "verify" call to action that would send them back to onboarding.
  if (profile.verificationStatus === "pending_review") {
    const hoodName = profile.requestedHood?.name ?? "your neighbourhood";
    return (
      <div className="border-b border-primary/15 bg-primary/5">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-bold text-foreground">Your request to join {hoodName} is being reviewed</p>
              <p className="text-sm text-foreground/75">
                Alerts, Events, Groups and For Sale &amp; Free unlock once you&apos;re approved. We&apos;ll let you know.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => router.push(ROUTES.settingsNeighbourhood)}>
            View request
          </Button>
        </div>
      </div>
    );
  }

  const joined = profile.isOnboarded;

  return (
    <div className="border-b border-warning/20 bg-warning-soft">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-bold text-foreground">{joined ? "Verify your address" : "You're browsing with limited access"}</p>
            <p className="text-sm text-foreground/75">
              {joined
                ? "We couldn't confirm where you live yet, so Alerts, Events, Groups and For Sale & Free are locked."
                : "Finish joining your neighbourhood to see your feed and unlock Alerts, Events, Groups and For Sale & Free."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => router.push(ROUTES.onboarding)}>
            {joined ? "Verify location" : "Finish joining"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "mailto:hello@myhoodora.com";
            }}
          >
            Contact support
          </Button>
        </div>
      </div>
    </div>
  );
}
