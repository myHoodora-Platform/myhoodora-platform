"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiError } from "@myhoodora/api-contract/errors";
import { useAuth } from "@/context/AuthContext";
import { needsAgeCheck } from "@/lib/auth/profile";
import { claimInvite } from "@/lib/api/invites";
import { isLive } from "@/lib/api/config";
import { clearSavedInvite, forgetMyInviteCode, readSavedInvite } from "./invite-ref";
import { loadInvites, resetInvites } from "./use-invites";

/**
 * Once someone is signed in (and past the age check): credit whoever invited them, from the code they
 * arrived with, then load their own invite summary. Renders nothing.
 */
export function InviteBootstrap() {
  const { user, profile, profileStatus } = useAuth();
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (done.current) {
        done.current = null;
        resetInvites();
        forgetMyInviteCode();
      }
      return;
    }
    if (!isLive("invites") || profileStatus !== "ready" || !profile || needsAgeCheck(profile) || done.current === user.uid) return;
    done.current = user.uid;
    void (async () => {
      const saved = readSavedInvite();
      if (saved) {
        try {
          const { invitedBy } = await claimInvite(user, { code: saved.code, via: saved.via });
          clearSavedInvite();
          toast.success(`Welcome! ${invitedBy.name} gets the credit for inviting you.`);
        } catch (err) {
          // Their own code, an unknown one, or they'd already said: nothing more to do with it.
          // A network blip keeps it for next time.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) clearSavedInvite();
        }
      }
      await loadInvites(user).catch(() => undefined);
    })();
  }, [user, profile, profileStatus]);

  return null;
}
