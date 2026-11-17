import { ApiError } from "@myhoodora/api-contract/errors";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { claimInvite, getInviteSummary, inviteKeys } from "./invites-api";
import { clearSavedInvite, loadMyInviteCode, readSavedInvite, rememberMyInviteCode } from "@/core/invites/invite-ref";

/** Past the age check: the account is real, so the invite can be claimed (and the API allows it). */
const CLAIMABLE = new Set(["needsTerms", "needsOnboarding", "ready"]);

/**
 * Once someone is signed in: credit whoever invited them, from the code they arrived with, then load
 * their own code (shared links carry it). Mounted once, in the root navigator.
 */
export function useClaimSavedInvite() {
  const { user, phase } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const done = useRef<string | null>(null);

  useEffect(() => {
    void loadMyInviteCode();
  }, []);

  useEffect(() => {
    if (!user) {
      if (done.current) void rememberMyInviteCode(null);
      done.current = null;
      return;
    }
    if (!CLAIMABLE.has(phase) || done.current === user.uid) return;
    done.current = user.uid;
    void (async () => {
      const saved = await readSavedInvite();
      if (saved) {
        try {
          const { invitedBy } = await claimInvite(user, { code: saved.code, via: saved.via });
          await clearSavedInvite();
          toast(`Welcome! ${invitedBy.name} gets the credit for inviting you.`);
        } catch (err) {
          // Their own code, an unknown one, or already answered: done with it. A network blip keeps it.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) await clearSavedInvite();
        }
      }
      try {
        const summary = await getInviteSummary(user);
        client.setQueryData(inviteKeys.me(user.uid), summary);
        await rememberMyInviteCode(summary.code);
      } catch {
        // Tried again when the Invite screen or the feed card asks.
      }
    })();
  }, [user, phase, client, toast]);
}
