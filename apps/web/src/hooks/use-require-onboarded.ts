"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

/** Opens the existing onboarding-gating modal if the user hasn't completed onboarding yet. */
export function useRequireOnboarded() {
  const { profile, setIsGatingModalOpen } = useAuth();

  useEffect(() => {
    if (profile && !profile.isOnboarded) {
      setIsGatingModalOpen(true);
    }
  }, [profile, setIsGatingModalOpen]);
}
