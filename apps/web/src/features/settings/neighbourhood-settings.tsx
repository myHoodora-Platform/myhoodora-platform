"use client";

import { useState } from "react";
import { BadgeCheck, Hourglass, MapPin, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { errorMessage } from "@/lib/api/client";
import { timeAgo } from "@/lib/time";
import { SettingsRow, SettingsSection } from "./ui";

export function NeighbourhoodSettings() {
  const { profile, setIsGatingModalOpen, cancelHoodRequest } = useAuth();
  const hood = useNeighbourhood();
  const verified = profile?.verificationStatus === "verified";
  const request = profile?.verificationStatus === "pending_review" ? (profile.requestedHood ?? null) : null;
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelHoodRequest();
      toast.success("Your request has been cancelled.");
      setConfirmingCancel(false);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't cancel your request. Please try again."));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Your neighbourhood" description="You see and post to neighbours here.">
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold">{hood?.name ?? (request ? request.name : "Not set yet")}</p>
            <p className="text-sm text-muted-foreground">
              {request ? "Waiting for approval" : [hood?.city, hood?.country].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <SettingsRow
          label="Verification"
          description={
            verified
              ? "Your address is confirmed. You have full access to Alerts, Events, Groups and For Sale & Free."
              : request
                ? `You asked to join ${request.name} ${timeAgo(request.requestedAt)}. Our team is reviewing it and we'll let you know. Alerts, Events, Groups and For Sale & Free unlock once you're approved.`
                : "Confirm your address to unlock Alerts, Events, Groups and For Sale & Free."
          }
        >
          {request ? (
            confirmingCancel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Cancel this request?</span>
                <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => void handleCancel()} loading={cancelling}>
                  Yes, cancel
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                  Keep it
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                  <Hourglass className="size-4" aria-hidden /> Pending
                </span>
                <Button size="sm" variant="outline" onClick={() => setConfirmingCancel(true)}>
                  Cancel request
                </Button>
              </div>
            )
          ) : verified ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
              <BadgeCheck className="size-4" aria-hidden /> Verified
            </span>
          ) : (
            <Button size="sm" onClick={() => setIsGatingModalOpen(true)}>
              <ShieldAlert className="size-4" /> Verify now
            </Button>
          )}
        </SettingsRow>
        {profile?.location?.address && (
          <SettingsRow
            label="Your address"
            description={
              <>
                {profile.location.address}
                <span className="block text-xs">Never shown to neighbours. Only your neighbourhood name is.</span>
              </>
            }
          />
        )}
      </SettingsSection>

      <SettingsSection title="Moving house?">
        <SettingsRow label="Change neighbourhood" description="Moving isn't self-serve yet. Tell us your new address and we'll move you after verifying it.">
          <Button variant="outline" size="sm" onClick={() => (window.location.href = "mailto:hello@myhoodora.com?subject=Moving%20neighbourhood")}>
            Contact support
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
