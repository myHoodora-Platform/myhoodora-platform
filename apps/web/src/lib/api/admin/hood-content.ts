import type { User } from "firebase/auth";
import type {
  ActivationInput,
  ComposeInput,
  ContentItem,
  ContentItemInput,
  ContentTag,
  DailyOverview,
  DailySettings,
  ImportResult,
  ScheduleResult,
  ScheduleSource,
  ScheduledStatus,
  ScheduledTeamPost,
} from "@myhoodora/api-contract/hood-content";
import { ApiError, apiFetch } from "../client";
import { isLive } from "../config";
import { adminGet, adminSend } from "./http";
import { listHoods } from "./community";
import type { AdminHood } from "./types";

function requireLive(): void {
  if (!isLive("admin.hoodContent")) throw new ApiError("The Hood Team's content needs the live API. Turn off preview mode to manage it.", 503, "server");
}

/** live: GET /admin/hood-content/items?tag&q&active */
export async function listContentItems(user: User, query: { tag?: ContentTag | "all"; q?: string } = {}): Promise<ContentItem[]> {
  requireLive();
  return adminGet(user, "/hood-content/items", query);
}

export async function createContentItem(user: User, input: ContentItemInput): Promise<ContentItem> {
  requireLive();
  return adminSend(user, "/hood-content/items", input);
}

export async function updateContentItem(user: User, id: string, input: ContentItemInput): Promise<ContentItem> {
  requireLive();
  return adminSend(user, `/hood-content/items/${encodeURIComponent(id)}`, input, "PATCH");
}

export async function deleteContentItem(user: User, id: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/hood-content/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The content bank markdown (docs/product/hood-content-bank.md). */
export async function importContentBank(user: User, markdown: string, overwrite = false): Promise<ImportResult> {
  requireLive();
  return adminSend(user, "/hood-content/items/import", { markdown, overwrite });
}

export async function composeTeamPost(user: User, input: ComposeInput): Promise<ScheduleResult> {
  requireLive();
  return adminSend(user, "/hood-content/compose", input);
}

export async function applyActivationPlan(user: User, input: ActivationInput): Promise<ScheduleResult> {
  requireLive();
  return adminSend(user, "/hood-content/activation", input);
}

export async function listScheduledTeamPosts(user: User, query: { status?: ScheduledStatus | "all"; source?: ScheduleSource | "all"; batchId?: string; limit?: number } = {}): Promise<ScheduledTeamPost[]> {
  requireLive();
  return adminGet(user, "/hood-content/scheduled", query);
}

export async function cancelScheduledTeamPost(user: User, id: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/hood-content/scheduled/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export async function cancelTeamBatch(user: User, batchId: string): Promise<{ cancelled: number }> {
  requireLive();
  return adminSend(user, `/hood-content/batches/${encodeURIComponent(batchId)}/cancel`, {});
}

export async function getDailyOverview(user: User): Promise<DailyOverview> {
  requireLive();
  return adminGet(user, "/hood-content/daily");
}

export async function updateDailySettings(user: User, patch: Partial<Omit<DailySettings, "calendar">>): Promise<DailyOverview> {
  requireLive();
  return adminSend(user, "/hood-content/daily", patch, "PATCH");
}

export async function setDailyPromptFor(user: User, date: string, code: string | null): Promise<DailyOverview> {
  requireLive();
  return apiFetch(user, `/admin/hood-content/daily/calendar/${encodeURIComponent(date)}`, { method: "PUT", json: { code } });
}

export async function pinTeamPost(user: User, postId: string, days: number): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/hood-content/posts/${encodeURIComponent(postId)}/pin`, { method: "PATCH", json: { days } });
}

/** Every open Hood, for the "which Hoods" picker (the admin list pages 100 at a time). */
export async function listAllOpenHoods(user: User): Promise<AdminHood[]> {
  const out: AdminHood[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await listHoods(user, { page, pageSize: 100, status: "active", sort: "name:asc" });
    out.push(...res.items);
    if (out.length >= res.total || res.items.length === 0) break;
  }
  return out;
}
