import type { User } from "firebase/auth";
import { isLive } from "../config";
import { isRemoved, setRemoved } from "../mock/moderation-state";
import { load, save } from "../mock/store";
import { encodePostContent } from "../post-meta";
import type { ApiPost, Post } from "../types";
import { alertStatus, type AlertStatus } from "@/features/alerts/lifecycle";
import { actorOf, adminGet, adminSend, mock, notFound } from "./http";
import {
  allComments,
  allGroups,
  allListings,
  allPosts,
  auditFor,
  buildReports,
  decodePost,
  hoodById,
  nameOf,
  paginate,
  recordAudit,
} from "./mock-db";
import type { AdminComment, AdminGroup, AdminListing, AdminPost, AdminRole, AuditAction, ListQuery, Page, PostDetail } from "./types";

const openReportCount = (type: string, id: string) =>
  buildReports().filter((r) => r.target.type === type && r.target.id === id && (r.status === "open" || r.status === "under_review" || r.status === "escalated")).length;

const hoodRef = (id?: string) => {
  const h = hoodById(id);
  return h ? { id: h.id, name: h.name } : undefined;
};

function toAdminPost(p: ApiPost): AdminPost {
  const { message, meta } = decodePost(p);
  return {
    id: p._id,
    message,
    category: meta.category,
    urgent: meta.urgent,
    author: { uid: p.authorUid, displayName: nameOf(p.authorUid) },
    hood: hoodRef(p.neighborhoodId),
    createdAt: p.createdAt,
    status: isRemoved("post", p._id) ? "removed" : "visible",
    reactions: p.likes.length,
    comments: allComments().filter((c) => c.postId === p._id).length,
    openReports: openReportCount("post", p._id),
  };
}

export interface PostQuery extends ListQuery {
  hoodId?: string;
  category?: string;
  authorUid?: string;
  status?: "visible" | "removed";
  reported?: boolean;
}

/** live: GET /admin/posts */
export async function listPosts(user: User, query: PostQuery = {}): Promise<Page<AdminPost>> {
  if (isLive("admin.content")) return adminGet(user, "/posts", query);
  return mock(() => {
    const rows = allPosts()
      .map(toAdminPost)
      .filter((p) => !query.hoodId || p.hood?.id === query.hoodId)
      .filter((p) => !query.category || p.category === query.category)
      .filter((p) => !query.authorUid || p.author.uid === query.authorUid)
      .filter((p) => !query.status || p.status === query.status)
      .filter((p) => !query.reported || p.openReports > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, query, (p) => `${p.message} ${p.author.displayName} ${p.hood?.name ?? ""}`, {
      created: (a, b) => a.createdAt.localeCompare(b.createdAt),
      reactions: (a, b) => a.reactions - b.reactions,
      reports: (a, b) => a.openReports - b.openReports,
    });
  });
}

/** live: GET /admin/posts/:id */
export async function getPost(user: User, id: string): Promise<PostDetail> {
  if (isLive("admin.content")) return adminGet(user, `/posts/${id}`);
  return mock(() => {
    const p = allPosts().find((x) => x._id === id);
    if (!p) notFound("Post");
    const { meta } = decodePost(p);
    const commentsList: AdminComment[] = allComments()
      .filter((c) => c.postId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        id: c._id,
        message: c.content,
        author: { uid: c.authorUid, displayName: nameOf(c.authorUid) },
        createdAt: c.createdAt,
        status: isRemoved("comment", c._id) ? "removed" : "visible",
      }));
    const commentIds = new Set(commentsList.map((c) => c.id));
    return {
      ...toAdminPost(p),
      media: p.mediaUrls,
      alertCategory: meta.alertCategory,
      commentsList,
      reports: buildReports().filter((r) => (r.target.type === "post" && r.target.id === id) || (r.target.type === "comment" && commentIds.has(r.target.id))),
      timeline: [...auditFor("post", id), ...[...commentIds].flatMap((c) => auditFor("comment", c))].sort((a, b) => b.at.localeCompare(a.at)),
    };
  });
}

/** live: POST /admin/posts/:id/actions · /admin/comments/:id/actions */
export async function actOnContent(
  user: User,
  type: "post" | "comment" | "listing" | "group",
  id: string,
  input: { action: "remove" | "restore"; reason: string; note?: string },
  role: AdminRole,
): Promise<void> {
  const path = { post: "posts", comment: "comments", listing: "listings", group: "groups" }[type];
  const key = type === "listing" ? "admin.marketplace" : type === "group" ? "admin.groups" : "admin.content";
  if (isLive(key)) return adminSend(user, `/${path}/${id}/actions`, input);
  await mock(() => {
    setRemoved(type, id, input.action === "remove");
    const label =
      type === "post"
        ? (() => {
            const p = allPosts().find((x) => x._id === id);
            return p ? `“${decodePost(p).message.slice(0, 60)}”` : id;
          })()
        : type === "comment"
          ? `“${(allComments().find((c) => c._id === id)?.content ?? id).slice(0, 60)}”`
          : type === "listing"
            ? (allListings().find((l) => l._id === id)?.title ?? id)
            : (allGroups().find((g) => g._id === id)?.name ?? id);
    const action: AuditAction = input.action === "remove" ? "remove_content" : "restore_content";
    recordAudit(actorOf(user, role), action, { type, id, label }, input.reason, input.note);
  }, 300);
}

// ── Safety alerts ───────────────────────────────────────────────────────────

export interface AdminAlert extends AdminPost {
  alertCategory: string;
  level: AlertStatus;
}

const resolutions = () => load<Record<string, string>>("alert-resolved", () => ({}));

/** live: GET /admin/alerts */
export async function listAlerts(user: User, query: ListQuery & { level?: AlertStatus | "live"; hoodId?: string } = {}): Promise<Page<AdminAlert>> {
  if (isLive("admin.content")) return adminGet(user, "/alerts", query);
  return mock(() => {
    const resolved = resolutions();
    const rows = allPosts()
      .filter((p) => decodePost(p).meta.category === "alert" && !isRemoved("post", p._id))
      .map<AdminAlert>((p) => {
        const { meta } = decodePost(p);
        const shaped = { createdAt: p.createdAt, meta, resolvedAt: resolved[p._id] ?? null } as unknown as Post;
        return { ...toAdminPost(p), alertCategory: meta.alertCategory ?? "other", level: alertStatus(shaped) };
      })
      .filter((a) => !query.hoodId || a.hood?.id === query.hoodId)
      .filter((a) => (query.level === "live" ? a.level === "urgent" || a.level === "active" : !query.level || a.level === query.level))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, query, (a) => `${a.message} ${a.author.displayName} ${a.alertCategory}`);
  });
}

/** live: POST /admin/alerts/:id/actions */
export async function actOnAlert(user: User, id: string, input: { action: "end" | "downgrade" | "remove"; reason: string }, role: AdminRole): Promise<void> {
  if (isLive("admin.content")) return adminSend(user, `/alerts/${id}/actions`, input);
  await mock(() => {
    const p = allPosts().find((x) => x._id === id);
    if (!p) notFound("Alert");
    const { message, meta } = decodePost(p);
    if (input.action === "end") save("alert-resolved", { ...resolutions(), [id]: new Date().toISOString() });
    if (input.action === "remove") setRemoved("post", id, true);
    if (input.action === "downgrade") {
      const posts = load<ApiPost[]>("posts", () => []);
      save("posts", posts.map((x) => (x._id === id ? { ...x, content: encodePostContent(message, { ...meta, urgent: false }) } : x)));
    }
    const action: AuditAction = input.action === "end" ? "alert_end" : input.action === "downgrade" ? "alert_downgrade" : "remove_content";
    recordAudit(actorOf(user, role), action, { type: "post", id, label: `“${message.slice(0, 60)}”` }, input.reason);
  }, 300);
}

// ── Marketplace & groups ────────────────────────────────────────────────────

/** live: GET /admin/listings */
export async function listListingsAdmin(user: User, query: ListQuery & { status?: AdminListing["status"]; reported?: boolean } = {}): Promise<Page<AdminListing>> {
  if (isLive("admin.marketplace")) return adminGet(user, "/listings", query);
  return mock(() => {
    const rows = allListings()
      .map<AdminListing>((l) => ({
        id: l._id,
        title: l.title,
        priceNaira: l.priceNaira,
        category: l.category,
        seller: { uid: l.sellerUid, displayName: nameOf(l.sellerUid) },
        hood: hoodRef(l.neighborhoodId),
        createdAt: l.createdAt,
        status: isRemoved("listing", l._id) ? "removed" : l.status === "sold" ? "sold" : "active",
        openReports: openReportCount("listing", l._id),
      }))
      .filter((l) => !query.status || l.status === query.status)
      .filter((l) => !query.reported || l.openReports > 0)
      .sort((a, b) => b.openReports - a.openReports || b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, query, (l) => `${l.title} ${l.seller.displayName}`);
  });
}

/** live: GET /admin/groups */
export async function listGroupsAdmin(user: User, query: ListQuery & { status?: AdminGroup["status"]; reported?: boolean } = {}): Promise<Page<AdminGroup>> {
  if (isLive("admin.groups")) return adminGet(user, "/groups", query);
  return mock(() => {
    const rows = allGroups()
      .map<AdminGroup>((g) => ({
        id: g._id,
        name: g.name,
        privacy: g.privacy,
        category: g.category,
        members: g.memberCount,
        official: g.official,
        hood: hoodRef(g.neighborhoodId),
        createdAt: (g as { createdAt?: string }).createdAt ?? new Date().toISOString(),
        status: isRemoved("group", g._id) ? "archived" : "active",
        openReports: openReportCount("group", g._id),
      }))
      .filter((g) => !query.status || g.status === query.status)
      .filter((g) => !query.reported || g.openReports > 0)
      .sort((a, b) => b.members - a.members);
    return paginate(rows, query, (g) => `${g.name} ${g.category}`);
  });
}
