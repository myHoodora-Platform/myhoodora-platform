import type { User } from "firebase/auth";
import type { ClaimInviteInput, InviteSummary, PublicInvite } from "@myhoodora/api-contract/invites";
import { API_BASE_URL, isLive } from "./config";
import { apiFetch } from "./client";
import { deviceId } from "@/features/invites/invite-ref";

/** live: GET /invites/me — my code and link, who joined with it, and whether to ask who invited me. Null without the API. */
export async function getInviteSummary(user: User): Promise<InviteSummary | null> {
  if (!isLive("invites")) return null;
  const device = deviceId();
  return apiFetch<InviteSummary>(user, `/invites/me${device ? `?device=${encodeURIComponent(device)}` : ""}`);
}

/** live: POST /invites/claim. Throws the API's error (404 unknown code, 409 already answered, 400 not allowed). */
export async function claimInvite(user: User, input: ClaimInviteInput): Promise<{ invitedBy: { name: string } }> {
  return apiFetch(user, "/invites/claim", { method: "POST", json: { ...input, device: input.device ?? deviceId() } });
}

/** live: POST /invites/me/dismiss — "Who invited you?" closed without an answer. */
export async function dismissWhoInvited(user: User): Promise<void> {
  if (!isLive("invites")) return;
  await apiFetch<void>(user, "/invites/me/dismiss", { method: "POST" });
}

export type PublicInviteResult = { status: "ok"; invite: PublicInvite } | { status: "missing" } | { status: "unavailable" };

/** live: GET /public/invites/:code, server-side, for the /i/<code> landing page. */
export async function getPublicInvite(code: string): Promise<PublicInviteResult> {
  if (!isLive("invites") || !/^[A-Za-z0-9-]{4,14}$/.test(code)) return { status: "missing" };
  try {
    const res = await fetch(`${API_BASE_URL}/public/invites/${encodeURIComponent(code)}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8_000) });
    if (res.status === 404) return { status: "missing" };
    if (!res.ok) return { status: "unavailable" };
    return { status: "ok", invite: (await res.json()) as PublicInvite };
  } catch {
    return { status: "unavailable" };
  }
}
