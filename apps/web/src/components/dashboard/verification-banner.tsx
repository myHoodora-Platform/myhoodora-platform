"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { ShieldAlert } from "lucide-react";

export function VerificationBanner() {
  const { profile } = useAuth();

  if (!profile || profile.verificationStatus === "verified") return null;

  return (
    <div className="border-b border-amber-200/60 bg-amber-50 px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              Pending Verification
            </p>
            <p className="text-xs text-amber-800/80">
              We couldn&apos;t confirm your address yet, so some neighborhood
              features are limited. Having trouble? Our support team can help.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            window.location.href = "mailto:hello@myhoodora.com";
          }}
        >
          Contact Support
        </Button>
      </div>
    </div>
  );
}
