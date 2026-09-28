"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";

export function VerificationBanner() {
  const { profile, setIsGatingModalOpen } = useAuth();

  if (!profile || profile.verificationStatus === "verified") return null;

  return (
    <div className="border-b border-warning/20 bg-warning-soft">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-bold text-foreground">Verify your address</p>
            <p className="text-sm text-foreground/75">
              We couldn&apos;t confirm where you live yet, so Alerts, Events, Groups and For Sale &amp; Free are locked.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setIsGatingModalOpen(true)}>
            Verify location
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
