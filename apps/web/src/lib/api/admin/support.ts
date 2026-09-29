import type { User } from "firebase/auth";
import { ApiError } from "../client";
import { isLive } from "../config";
import { mockId } from "../mock/store";
import { actorOf, adminGet, adminSend, forbidden, mock, notFound } from "./http";
import { broadcasts, buildThreads, hoods, neighbours, paginate, patchThread, recordAudit, saveBroadcasts } from "./mock-db";
import type { AdminRole, Broadcast, BroadcastAudience, InboxStatus, InboxThread, ListQuery, Page } from "./types";

// ── Inbox ───────────────────────────────────────────────────────────────────

export interface InboxQuery extends ListQuery {
  status?: InboxStatus;
  source?: InboxThread["source"];
}

/** live: GET /admin/inbox */
export async function listInbox(user: User, query: InboxQuery = {}): Promise<Page<InboxThread>> {
  if (isLive("admin.inbox")) return adminGet(user, "/inbox", query);
  return mock(() => {
    const rank = { high: 3, normal: 2, low: 1 } as const;
    const rows = buildThreads()
      .filter((t) => !query.status || t.status === query.status)
      .filter((t) => !query.source || t.source === query.source)
      .sort((a, b) => rank[b.priority] - rank[a.priority] || a.updatedAt.localeCompare(b.updatedAt));
    return paginate(rows, query, (t) => `${t.subject} ${t.from.name} ${t.from.email} ${t.messages.map((m) => m.body).join(" ")}`);
  });
}

/** live: GET /admin/inbox/:id */
export async function getThread(user: User, id: string): Promise<InboxThread> {
  if (isLive("admin.inbox")) return adminGet(user, `/inbox/${id}`);
  return mock(() => {
    const t = buildThreads().find((x) => x.id === id);
    if (!t) notFound("Conversation");
    return t;
  });
}

/** live: POST /admin/inbox/:id/reply → emails / notifies the neighbour */
export async function replyToThread(user: User, id: string, body: string, role: AdminRole, resolve = false): Promise<InboxThread> {
  if (isLive("admin.inbox")) return adminSend(user, `/inbox/${id}/reply`, { body, resolve });
  await mock(() => {
    const t = buildThreads().find((x) => x.id === id);
    if (!t) notFound("Conversation");
    const actor = actorOf(user, role);
    const now = new Date().toISOString();
    patchThread(id, {
      messages: [...t.messages, { from: "staff", body, at: now, by: actor.displayName }],
      status: resolve ? "resolved" : "waiting",
      updatedAt: now,
    });
    recordAudit(actor, "inbox_reply", { type: "inbox", id, label: t.subject });
  }, 350);
  return getThread(user, id);
}

/** live: PATCH /admin/inbox/:id */
export async function updateThread(user: User, id: string, patch: Partial<Pick<InboxThread, "status" | "priority">> & { assignToMe?: boolean }, role: AdminRole): Promise<InboxThread> {
  if (isLive("admin.inbox")) return adminSend(user, `/inbox/${id}`, patch, "PATCH");
  await mock(() => {
    const { assignToMe, ...rest } = patch;
    const actor = actorOf(user, role);
    patchThread(id, { ...rest, ...(assignToMe ? { assignee: { uid: actor.uid, displayName: actor.displayName } } : {}), updatedAt: new Date().toISOString() });
  }, 200);
  return getThread(user, id);
}

// ── Broadcasts ──────────────────────────────────────────────────────────────

function reachOf(audience: BroadcastAudience): number {
  if (audience.type === "all") return hoods().filter((h) => h.status === "active").reduce((n, h) => n + h.stats.members, 0);
  if (audience.type === "hood") return hoods().filter((h) => audience.hoodIds.includes(h.id)).reduce((n, h) => n + h.stats.members, 0);
  return audience.uids.length;
}

function labelOf(audience: BroadcastAudience): string {
  if (audience.type === "all") return "Everyone";
  if (audience.type === "hood") return hoods().filter((h) => audience.hoodIds.includes(h.id)).map((h) => h.name).join(", ");
  const names = neighbours().filter((n) => audience.uids.includes(n.uid)).map((n) => n.displayName);
  return names.join(", ");
}

/** live: GET /admin/broadcasts */
export async function listBroadcasts(user: User): Promise<Broadcast[]> {
  if (isLive("admin.broadcasts")) return adminGet(user, "/broadcasts");
  return mock(() => [...broadcasts()].sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
}

/** live: POST /admin/broadcasts/estimate */
export async function estimateReach(user: User, audience: BroadcastAudience): Promise<number> {
  if (isLive("admin.broadcasts")) return (await adminSend<{ estimatedReach: number }>(user, "/broadcasts/estimate", { audience })).estimatedReach;
  return mock(() => reachOf(audience), 120);
}

/** live: POST /admin/broadcasts — "everyone" is admin only. */
export async function sendBroadcast(user: User, input: { title: string; body: string; audience: BroadcastAudience }, role: AdminRole): Promise<Broadcast> {
  if (isLive("admin.broadcasts")) return adminSend(user, "/broadcasts", input);
  return mock(() => {
    if (role === "moderator") forbidden();
    if (input.audience.type !== "all" && (input.audience.type === "hood" ? input.audience.hoodIds : input.audience.uids).length === 0) {
      throw new ApiError("Choose who should receive this.", 422, "client");
    }
    const actor = actorOf(user, role);
    const b: Broadcast = {
      id: mockId("bc"),
      ...input,
      audienceLabel: labelOf(input.audience),
      reach: reachOf(input.audience),
      sentAt: new Date().toISOString(),
      sentBy: actor.displayName,
    };
    saveBroadcasts([b, ...broadcasts()]);
    recordAudit(actor, "broadcast_send", { type: "broadcast", id: b.id, label: b.title }, b.audienceLabel);
    return b;
  }, 500);
}
