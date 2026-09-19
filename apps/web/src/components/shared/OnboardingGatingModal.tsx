"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { MapPin, X } from "lucide-react";

export function OnboardingGatingModal() {
  const router = useRouter();
  const { isGatingModalOpen, setIsGatingModalOpen } = useAuth();

  if (!isGatingModalOpen) return null;

  const handleGoToOnboarding = () => {
    setIsGatingModalOpen(false);
    router.push("/onboarding");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark Overlay backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={() => setIsGatingModalOpen(false)}
      ></div>

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl p-6 relative z-10 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={() => setIsGatingModalOpen(false)}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          {/* Header Pin Bubble */}
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MapPin className="size-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-800">
              Complete Onboarding
            </h3>
            <p className="text-sm text-muted-foreground px-2">
              To contribute to your local community, post updates, list items,
              or RSVP to events, you need to verify your address first.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          <Button className="w-full" onClick={handleGoToOnboarding}>
            Verify neighborhood location
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setIsGatingModalOpen(false)}
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
