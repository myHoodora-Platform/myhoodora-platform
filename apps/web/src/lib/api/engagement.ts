import type { User } from "firebase/auth";
import type { BuilderRow, EngagementAdmin, EngagementSummary } from "@myhoodora/api-contract/engagement";
import { ApiError, apiFetch } from "./client";
import { API_BASE_URL, isLive } from "./config";
import { adminGet, adminSend } from "./admin/http";

/** live: GET /engagement/me — streak, challenge progress, badge (worked out fresh). Null without the API. */
export async function getEngagement(user: User): Promise<EngagementSummary | null> {
  if (!isLive("invites")) return null;
  return apiFetch<EngagementSummary>(user, "/engagement/me");
}

function requireLive(): void {
  if (!isLive("invites")) throw new ApiError("The challenge needs the live API. Turn off preview mode to manage it.", 503, "server");
}

export async function getEngagementAdmin(user: User): Promise<EngagementAdmin> {
  requireLive();
  return adminGet<EngagementAdmin>(user, "/engagement");
}

export async function updateEngagementAdmin(user: User, patch: Partial<EngagementAdmin["settings"]>): Promise<EngagementAdmin> {
  requireLive();
  return adminSend<EngagementAdmin>(user, "/engagement", patch, "PATCH");
}

export async function endChallenge(user: User): Promise<EngagementAdmin> {
  requireLive();
  return adminSend<EngagementAdmin>(user, "/engagement/end-challenge", {});
}

export async function getPersonEngagement(user: User, uid: string): Promise<EngagementSummary> {
  requireLive();
  return adminGet<EngagementSummary>(user, `/engagement/people/${encodeURIComponent(uid)}`);
}

export async function listBuilders(user: User): Promise<BuilderRow[]> {
  requireLive();
  return adminGet<BuilderRow[]>(user, "/engagement/builders");
}

export async function setBuilder(user: User, uid: string, on: boolean, reason: string): Promise<EngagementSummary> {
  requireLive();
  return apiFetch(user, `/admin/engagement/builders/${encodeURIComponent(uid)}`, { method: "PUT", json: { on, reason } });
}

export async function downloadBuildersCsv(user: User): Promise<void> {
  requireLive();
  const res = await fetch(`${API_BASE_URL}/admin/engagement/builders?format=csv`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!res.ok) throw new ApiError("Couldn't download the spreadsheet.", res.status, "server");
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: `hood-builders-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  URL.revokeObjectURL(url);
}
