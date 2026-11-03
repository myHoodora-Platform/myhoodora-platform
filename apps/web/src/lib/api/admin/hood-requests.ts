import type { User } from "firebase/auth";
import type { AdminHoodRequest, HoodRequestKind, HoodRequestStatus } from "@myhoodora/api-contract/types";
import { apiFetch } from "../client";
import { isLive } from "../config";
import { adminGet, adminSend, mock } from "./http";
import type { ListQuery, Page } from "./types";

export type { AdminHoodRequest };

/**
 * Neighbourhood requests (contract §31): following another Hood, or moving home. Live only; preview
 * (mock) mode has none, so the page shows its empty state.
 */
export async function listHoodRequests(user: User, query: ListQuery & { status?: HoodRequestStatus; kind?: HoodRequestKind } = {}): Promise<Page<AdminHoodRequest>> {
  if (isLive("admin.hoodRequests")) return adminGet(user, "/hood-requests", query);
  return mock(() => ({ items: [], page: query.page ?? 1, pageSize: query.pageSize ?? 25, total: 0 }));
}

/** Approve: add the secondary Hood, or move them (to `hoodId` when it isn't the one their address is in). `note` stays with staff. */
export async function approveHoodRequest(user: User, id: string, input: { hoodId?: string; note?: string }): Promise<void> {
  if (isLive("admin.hoodRequests")) await adminSend(user, `/hood-requests/${id}/approve`, input);
}

/** `reason` is shown to the neighbour; `note` stays with staff. */
export async function declineHoodRequest(user: User, id: string, input: { reason: string; note?: string }): Promise<void> {
  if (isLive("admin.hoodRequests")) await adminSend(user, `/hood-requests/${id}/decline`, input);
}

/** Opens (or continues) a support conversation about the request; it shows in the neighbour's Messages. */
export async function messageAboutHoodRequest(user: User, id: string, body: string): Promise<{ threadId: string }> {
  if (isLive("admin.hoodRequests")) return adminSend(user, `/hood-requests/${id}/chat`, { body });
  return { threadId: "" };
}

/** Take a secondary Hood away from a neighbour; `reason` is shown to them. */
export async function removeSecondaryHood(user: User, uid: string, hoodId: string, input: { reason: string; note?: string }): Promise<void> {
  if (isLive("admin.hoodRequests")) await apiFetch(user, `/admin/neighbours/${uid}/secondary-hoods/${hoodId}/remove`, { method: "POST", json: input });
}
