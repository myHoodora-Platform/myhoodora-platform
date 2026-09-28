"use client";

import { BadgeCheck, MapPin, ShieldAlert } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { SettingsRow, SettingsSection } from "./ui";

export function NeighbourhoodSettings() {
  const { profile, setIsGatingModalOpen } = useAuth();
  const hood = useNeighbourhood();
  const verified = profile?.verificationStatus === "verified";

  return (
    <div className="space-y-4">
      <SettingsSection title="Your neighbourhood" description="You see and post to neighbours here.">
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold">{hood?.name ?? "Not set yet"}</p>
            <p className="text-sm text-muted-foreground">{[hood?.city, hood?.country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <SettingsRow
          label="Verification"
          description={
            verified
              ? "Your address is confirmed. You have full access to Alerts, Events, Groups and For Sale & Free."
              : "Confirm your address to unlock Alerts, Events, Groups and For Sale & Free."
          }
        >
          {verified ? (
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
