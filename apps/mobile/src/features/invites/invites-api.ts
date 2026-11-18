import type { User } from "firebase/auth";
import type { ClaimInviteInput, InviteSummary } from "@myhoodora/api-contract/invites";
import { apiFetch } from "@/core/api/client";
import { deviceId } from "@/core/invites/device-id";

export const inviteKeys = { me: (uid: string) => ["invites", "me", uid] as const, engagement: (uid: string) => ["engagement", "me", uid] as const };

/** GET /engagement/me (contract §42): streak, launch challenge progress, badge. */
export function getEngagement(user: User): Promise<import("@myhoodora/api-contract/engagement").EngagementSummary> {
  return apiFetch(user, "/engagement/me");
}

/** GET /invites/me (contract §40). */
export async function getInviteSummary(user: User): Promise<InviteSummary> {
  const device = await deviceId();
  return apiFetch<InviteSummary>(user, `/invites/me${device ? `?device=${encodeURIComponent(device)}` : ""}`);
}

/** POST /invites/claim: 404 unknown code, 409 already answered, 400 not allowed. */
export async function claimInvite(user: User, input: ClaimInviteInput): Promise<{ invitedBy: { name: string } }> {
  return apiFetch(user, "/invites/claim", { method: "POST", json: { ...input, device: input.device ?? (await deviceId()) } });
}

/** POST /invites/me/dismiss: "Who invited you?" closed without answering. */
export function dismissWhoInvited(user: User): Promise<void> {
  return apiFetch<void>(user, "/invites/me/dismiss", { method: "POST" });
}
