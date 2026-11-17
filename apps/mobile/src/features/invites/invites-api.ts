import type { User } from "firebase/auth";
import type { ClaimInviteInput, InviteSummary } from "@myhoodora/api-contract/invites";
import { apiFetch } from "@/core/api/client";

export const inviteKeys = { me: (uid: string) => ["invites", "me", uid] as const };

/** GET /invites/me (contract §40). */
export function getInviteSummary(user: User): Promise<InviteSummary> {
  return apiFetch<InviteSummary>(user, "/invites/me");
}

/** POST /invites/claim: 404 unknown code, 409 already answered, 400 not allowed. */
export function claimInvite(user: User, input: ClaimInviteInput): Promise<{ invitedBy: { name: string } }> {
  return apiFetch(user, "/invites/claim", { method: "POST", json: input });
}

/** POST /invites/me/dismiss: "Who invited you?" closed without answering. */
export function dismissWhoInvited(user: User): Promise<void> {
  return apiFetch<void>(user, "/invites/me/dismiss", { method: "POST" });
}
