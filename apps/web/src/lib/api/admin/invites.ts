import type { User } from "firebase/auth";
import type { InviteFlagGroup, InviteLeaderboard, StaffInviteView } from "@myhoodora/api-contract/invites";
import { ApiError, apiFetch } from "../client";
import { API_BASE_URL, isLive } from "../config";
import { adminGet, qs } from "./http";

function requireLive(): void {
  if (!isLive("invites")) throw new ApiError("Invites need the live API. Turn off preview mode to see them.", 503, "server");
}

/** live: GET /admin/invites — top inviters and Hoods. */
export async function getInviteLeaderboard(user: User, q: { from?: string; hoodId?: string } = {}): Promise<InviteLeaderboard> {
  requireLive();
  return adminGet<InviteLeaderboard>(user, "/invites", q);
}

/** live: GET /admin/invites?format=csv — downloads the spreadsheet. */
export async function downloadInviteCsv(user: User, q: { from?: string; hoodId?: string } = {}): Promise<void> {
  requireLive();
  const res = await fetch(`${API_BASE_URL}/admin/invites${qs({ ...q, format: "csv" })}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!res.ok) throw new ApiError("Couldn't download the spreadsheet.", res.status, "server");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `myhoodora-invites-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

/** live: PUT /admin/invites/:uid — credit someone else (code) or nobody (null). Audited. */
export async function setInviter(user: User, inviteeUid: string, code: string | null, reason: string): Promise<{ invitedBy: { name: string; code: string } | null }> {
  requireLive();
  return apiFetch(user, `/admin/invites/${encodeURIComponent(inviteeUid)}`, { method: "PUT", json: { code, reason } });
}

/** live: GET /admin/invites/flags — invites that look like one person, not yet reviewed. */
export async function getInviteFlags(user: User): Promise<InviteFlagGroup[]> {
  requireLive();
  return adminGet<InviteFlagGroup[]>(user, "/invites/flags");
}

/** live: GET /admin/invites/people/:uid — a neighbour's code, inviter (and flags), and their invites. */
export async function getStaffInvite(user: User, uid: string): Promise<StaffInviteView> {
  requireLive();
  return adminGet<StaffInviteView>(user, `/invites/people/${encodeURIComponent(uid)}`);
}

/** live: POST /admin/invites/:uid/reviewed — a flagged invite is fine; stop flagging it. Audited. */
export async function markInviteReviewed(user: User, inviteeUid: string, reason: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/invites/${encodeURIComponent(inviteeUid)}/reviewed`, { method: "POST", json: { reason } });
}
