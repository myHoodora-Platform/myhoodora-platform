import type { User } from "firebase/auth";
import { ApiError } from "../client";
import { isLive } from "../config";
import { setRemoved } from "../mock/moderation-state";
import { actorOf, adminGet, adminSend, forbidden, mock, notFound } from "./http";
import {
  allComments,
  allListings,
  allPosts,
  audit,
  auditFor,
  buildReports,
  decodePost,
  hoodById,
  isContentRemoved,
  nameOf,
  neighbourById,
  neighbours,
  paginate,
  recordAudit,
  reportState,
  reportsFor,
  saveNeighbours,
  saveReportState,
  severityRank,
} from "./mock-db";
import type {
  AdminReport,
  AdminRole,
  AuditEvent,
  ListQuery,
  ModerationActionInput,
  Page,
  ReportDetail,
  ReportedContent,
  ReportSeverity,
  ReportStatus,
  ReportTargetType,
} from "./types";

export interface ReportQuery extends ListQuery {
  status?: ReportStatus | "active" | "all";
  type?: ReportTargetType;
  reason?: string;
  hoodId?: string;
  authorUid?: string;
  severity?: ReportSeverity;
}

/** Queue order: most severe first, then oldest (Nextdoor/T&S practice). */
function queueOrder(a: AdminReport, b: AdminReport) {
  return severityRank(b.severity) - severityRank(a.severity) || a.firstReportedAt.localeCompare(b.firstReportedAt);
}

/** live: GET /admin/reports */
export async function listReports(user: User, query: ReportQuery = {}): Promise<Page<AdminReport>> {
  if (isLive("admin.moderation")) return adminGet(user, "/reports", query);
  return mock(() => {
    const rows = buildReports()
      // No status (or "all") = every report, matching the API; "active" = still needs work.
      .filter((r) =>
        !query.status || query.status === "all"
          ? true
          : query.status === "active"
            ? r.status === "open" || r.status === "under_review" || r.status === "escalated"
            : r.status === query.status,
      )
      .filter((r) => !query.type || r.target.type === query.type)
      .filter((r) => !query.reason || r.reasons.some((x) => x.reason === query.reason))
      .filter((r) => !query.hoodId || r.target.hoodId === query.hoodId)
      .filter((r) => !query.authorUid || r.target.authorUid === query.authorUid)
      .filter((r) => !query.severity || r.severity === query.severity)
      .sort(queueOrder);
    return paginate(rows, query, (r) => `${r.target.preview} ${nameOf(r.target.authorUid)}`, {
      reported: (a, b) => a.firstReportedAt.localeCompare(b.firstReportedAt),
      reporters: (a, b) => a.reporterCount - b.reporterCount,
    });
  });
}

function contentFor(type: ReportTargetType, id: string): ReportedContent {
  const removed = isContentRemoved(type, id);
  if (type === "post") {
    const p = allPosts().find((x) => x._id === id);
    if (!p) return { kind: "other", label: "This post no longer exists." };
    const { message, meta } = decodePost(p);
    return { kind: "post", message, category: meta.category, createdAt: p.createdAt, media: p.mediaUrls, urgent: meta.urgent, removed };
  }
  if (type === "comment") {
    const c = allComments().find((x) => x._id === id);
    if (!c) return { kind: "other", label: "This comment no longer exists." };
    const p = allPosts().find((x) => x._id === c.postId);
    return { kind: "comment", message: c.content, createdAt: c.createdAt, onPost: { id: c.postId, message: p ? decodePost(p).message : "" }, removed };
  }
  if (type === "listing") {
    const l = allListings().find((x) => x._id === id);
    if (!l) return { kind: "other", label: "This listing no longer exists." };
    return { kind: "listing", title: l.title, description: l.description, priceNaira: l.priceNaira, createdAt: l.createdAt, removed };
  }
  if (type === "user") {
    const n = neighbourById(id);
    return { kind: "user", displayName: n?.displayName ?? "Unknown", bio: n?.bio };
  }
  return { kind: "other", label: `${type} ${id}` };
}

/** live: GET /admin/reports/:id */
export async function getReport(user: User, id: string): Promise<ReportDetail> {
  if (isLive("admin.moderation")) return adminGet(user, `/reports/${encodeURIComponent(id)}`);
  return mock(() => {
    const all = buildReports();
    const report = all.find((r) => r.id === id);
    if (!report) notFound("Report");
    const { type, id: targetId, authorUid, hoodId } = report.target;
    const author = neighbourById(authorUid);
    const hood = hoodById(hoodId ?? author?.hoodId);
    return {
      ...report,
      content: contentFor(type, targetId),
      author: author && {
        uid: author.uid,
        displayName: author.displayName,
        role: author.role,
        hood: hoodById(author.hoodId) && { id: author.hoodId!, name: hoodById(author.hoodId)!.name },
        verificationStatus: author.verificationStatus,
        accountStatus: author.accountStatus,
        priorActions: auditFor("user", author.uid),
      },
      hood: hood && { id: hood.id, name: hood.name, city: hood.city },
      reports: reportsFor(type, targetId)
        .map((r) => ({ reason: r.reason, details: r.details, reporter: { uid: r.reporterUid, displayName: nameOf(r.reporterUid) }, at: r.createdAt }))
        .sort((a, b) => a.at.localeCompare(b.at)),
      related: all.filter((r) => r.id !== id && authorUid && r.target.authorUid === authorUid),
      timeline: [...auditFor(type, targetId), ...audit().filter((e) => e.target.type === "report" && e.target.id === id)].sort((a, b) => b.at.localeCompare(a.at)),
    };
  });
}

/** live: POST /admin/reports/:id/claim · /release */
export async function setReportClaim(user: User, id: string, claim: boolean, role: AdminRole): Promise<AdminReport> {
  if (isLive("admin.moderation")) return adminSend(user, `/reports/${encodeURIComponent(id)}/${claim ? "claim" : "release"}`, {});
  return mock(() => {
    const state = reportState();
    const current = state[id] ?? {};
    if (claim && current.assignee && current.assignee.uid !== user.uid) {
      throw new ApiError(`${current.assignee.displayName} is already reviewing this report.`, 409, "client");
    }
    const actor = actorOf(user, role);
    state[id] = claim
      ? { ...current, status: "under_review", assignee: { uid: actor.uid, displayName: actor.displayName } }
      : { ...current, status: "open", assignee: undefined };
    saveReportState(state);
    if (claim) recordAudit(actor, "claim", { type: "report", id, label: "Report" });
    return buildReports().find((r) => r.id === id)!;
  }, 150);
}

/** live: POST /admin/reports/:id/actions */
export async function actOnReport(user: User, id: string, input: ModerationActionInput, role: AdminRole): Promise<AdminReport> {
  if (isLive("admin.moderation")) return adminSend(user, `/reports/${encodeURIComponent(id)}/actions`, input);
  return mock(() => {
    if ((input.action === "suspend_author" || (input.restrictDays ?? 0) > 7) && role !== "admin") forbidden();
    const report = buildReports().find((r) => r.id === id);
    if (!report) notFound("Report");
    const actor = actorOf(user, role);
    const { type, id: targetId, authorUid, preview } = report.target;

    if (input.action === "remove_content" && (type === "post" || type === "comment" || type === "listing" || type === "group")) {
      setRemoved(type, targetId, true);
    }
    if ((input.action === "restrict_author" || input.action === "suspend_author") && authorUid) {
      const days = input.restrictDays ?? 7;
      saveNeighbours(
        neighbours().map((n) =>
          n.uid === authorUid
            ? input.action === "suspend_author"
              ? { ...n, accountStatus: "suspended", restrictedUntil: undefined }
              : { ...n, accountStatus: "restricted", restrictedUntil: new Date(Date.now() + days * 86_400_000).toISOString() }
            : n,
        ),
      );
    }

    const state = reportState();
    const status: ReportStatus = input.action === "keep" ? "dismissed" : input.action === "escalate" ? "escalated" : "resolved";
    state[id] = {
      ...state[id],
      status,
      assignee: status === "escalated" ? undefined : state[id]?.assignee,
      resolution: status === "escalated" ? undefined : { action: input.action, reason: input.reason, note: input.note, by: actor.displayName, at: new Date().toISOString() },
    };
    saveReportState(state);

    const label = preview.length > 60 ? `“${preview.slice(0, 60)}…”` : `“${preview}”`;
    const targetType = input.action === "restrict_author" || input.action === "suspend_author" || input.action === "warn_author" ? "user" : type;
    const target = targetType === "user" && authorUid ? { type: "user", id: authorUid, label: nameOf(authorUid) } : { type, id: targetId, label };
    recordAudit(actor, input.action, target, input.reason, input.note);
    return buildReports().find((r) => r.id === id)!;
  }, 400);
}

export interface AuditQuery extends ListQuery {
  actorUid?: string;
  action?: string;
  targetType?: string;
}

/** live: GET /admin/audit */
export async function listAudit(user: User, query: AuditQuery = {}): Promise<Page<AuditEvent>> {
  if (isLive("admin.moderation")) return adminGet(user, "/audit", query);
  return mock(() => {
    const rows = audit()
      .filter((e) => !query.actorUid || e.actor.uid === query.actorUid)
      .filter((e) => !query.action || e.action === query.action)
      .filter((e) => !query.targetType || e.target.type === query.targetType)
      .sort((a, b) => b.at.localeCompare(a.at));
    return paginate(rows, query, (e) => `${e.actor.displayName} ${e.target.label} ${e.reason ?? ""}`);
  });
}
