import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { AuditService, type AuditRecord } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { ReportReason, Severity } from "../platform/platform-settings.schema";
import { PlatformSettingsService } from "../platform/platform-settings.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";
import { StaffUsersService } from "../users/staff-users.service";
import { ModerationRegistry, type TargetSnapshot, type TargetType } from "./moderation-registry";
import { LeadsRosterService, MIN_LEADS_FOR_VOTING } from "./leads-roster.service";
import { ModerationCase, ModerationCaseDocument, Report, type CaseStatus, type ModerationAction } from "./moderation.schemas";

const RANK: Record<Severity, number> = { high: 1, medium: 2, low: 3 };
const REMOVABLE: TargetType[] = ["post", "comment", "listing", "group"];
/** Content Hood Leads may judge. Accounts, messages and businesses always go to staff. */
const LEAD_TYPES: TargetType[] = ["post", "comment", "listing", "group"];

/** Contract §13.2 AdminReport. */
export interface AdminReport {
  id: string;
  target: { type: TargetType; id: string; preview: string; authorUid?: string; hoodId?: string };
  reasons: { reason: ReportReason; count: number }[];
  reporterCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  severity: Severity;
  status: CaseStatus;
  assignee?: { uid: string; displayName: string };
  resolution?: { action: ModerationAction; reason: string; note?: string; by: string; at: string };
  /** "leads" while Hood Leads are voting on it. */
  route: "staff" | "leads";
}

export interface ReportQuery extends PageQuery {
  status?: CaseStatus | "active" | "all";
  type?: TargetType;
  reason?: ReportReason;
  hoodId?: string;
  authorUid?: string;
  severity?: Severity;
}

export interface DecisionInput {
  action: ModerationAction;
  reason: string;
  note?: string;
  restrictDays?: number;
}

/**
 * The moderation domain: turns reports into cases, routes them, records
 * decisions and enforces them (through the registry for content and
 * StaffUsersService for accounts). The same decide() will resolve Hood Lead
 * votes and appeals, so there's one enforcement path.
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(ModerationCase.name) private readonly cases: Model<ModerationCaseDocument>,
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly registry: ModerationRegistry,
    private readonly settings: PlatformSettingsService,
    private readonly staffUsers: StaffUsersService,
    private readonly audit: AuditService,
    private readonly hoods: HoodsService,
    private readonly notifications: NotificationsService,
    private readonly roster: LeadsRosterService,
  ) {}

  // ── Intake (POST /reports) ────────────────────────────────────────────────

  async snapshot(type: TargetType, id: string): Promise<TargetSnapshot | null> {
    if (type === "user") {
      const u = await this.users.findOne({ uid: id }).lean<User>().exec();
      return u
        ? { type, id, preview: `${u.displayName ?? "Neighbour"}${u.bio ? ` · “${u.bio}”` : ""}`, authorUid: u.uid, hoodId: u.neighborhoodId, removed: false, content: { kind: "user", displayName: u.displayName, bio: u.bio } }
        : null;
    }
    const handler = this.registry.get(type);
    if (handler) return handler.load(id);
    // Messages/groups/listings/businesses before their modules exist: staff still review by id.
    return { type, id, preview: `Reported ${type}`, removed: false, content: { kind: "other", label: `${type} ${id}` } };
  }

  async fileReport(viewer: Viewer, input: { targetType: TargetType; targetId: string; reason: ReportReason; details?: string }): Promise<void> {
    const snap = await this.snapshot(input.targetType, input.targetId);
    if (!snap) throw new NotFoundException("That isn't available any more.");
    if (snap.authorUid === viewer.uid) throw new BadRequestException("You can't report your own content.");
    // Reporters can only report what they can see: their own Hood (staff excepted).
    if (snap.hoodId && viewer.hoodId && snap.hoodId !== viewer.hoodId && !viewer.capabilities.includes("admin.access")) {
      throw new NotFoundException("That isn't available any more.");
    }
    const reasons = (await this.settings.get()).reportReasons;
    const setting = reasons.find((r) => r.id === input.reason)!;
    const staffOnly = setting.staffOnly || setting.severity === "high" || !LEAD_TYPES.includes(input.targetType);
    // Low-risk content in a Hood with enough active Leads goes to a Lead vote.
    const toLeads = !staffOnly && Boolean(snap.hoodId) && (await this.roster.activeLeadCount(snap.hoodId!)) >= MIN_LEADS_FOR_VOTING;
    const now = new Date();

    const already = { reporterUid: viewer.uid, targetType: input.targetType, targetId: input.targetId };
    if (await this.reports.exists(already).exec()) return; // Idempotent per reporter + item.

    // A duplicate-key error aborts the Mongo transaction server-side, so it must
    // propagate out of the callback (catching it inside would retry forever).
    await withTransaction(this.connection, async (session) => {
      const existing = await this.cases.findOne({ targetType: input.targetType, targetId: input.targetId }).session(session).exec();
      const kase =
        existing ??
        new this.cases({
          targetType: input.targetType,
          targetId: input.targetId,
          hoodId: snap.hoodId,
          authorUid: snap.authorUid,
          preview: snap.preview.slice(0, 200),
          severity: setting.severity,
          severityRank: RANK[setting.severity],
          route: toLeads ? "leads" : "staff",
          routedToLeadsAt: toLeads ? now : undefined,
          status: "open",
          firstReportedAt: now,
          lastReportedAt: now,
        });
      await this.reports.create([{ ...input, reporterUid: viewer.uid, caseId: String(kase._id) }], { session });
      kase.reasonCounts = { ...kase.reasonCounts, [input.reason]: (kase.reasonCounts?.[input.reason] ?? 0) + 1 };
      kase.reporterCount += 1;
      kase.lastReportedAt = now;
      if (RANK[setting.severity] < kase.severityRank) {
        kase.severity = setting.severity;
        kase.severityRank = RANK[setting.severity];
      }
      // A single high-risk report takes the whole case to staff.
      if (staffOnly) kase.route = "staff";
      // New reports reopen a dismissed case (not one already actioned).
      if (kase.status === "dismissed") {
        kase.status = "open";
        kase.resolution = null;
        if (kase.route === "leads") kase.routedToLeadsAt = now;
      }
      kase.markModified("reasonCounts");
      await kase.save({ session });
    }).catch((err: { code?: number }) => {
      // Lost a race with this reporter's own duplicate request (or with a first report creating the case).
      if (err?.code === 11000) return;
      throw err;
    });
  }

  // ── Queue & detail (admin §13.2) ──────────────────────────────────────────

  async list(q: ReportQuery): Promise<Page<AdminReport>> {
    const status: QueryFilter<ModerationCase> =
      !q.status || q.status === "all" ? {} : q.status === "active" ? { status: { $in: ["open", "under_review", "escalated"] } } : { status: q.status };
    const re = searchRegex(q.q);
    const filter: QueryFilter<ModerationCase> = {
      ...status,
      ...(q.type && { targetType: q.type }),
      ...(q.reason && { [`reasonCounts.${q.reason}`]: { $gt: 0 } }),
      ...(q.hoodId && { hoodId: q.hoodId }),
      ...(q.authorUid && { authorUid: q.authorUid }),
      ...(q.severity && { severity: q.severity }),
      ...(re && { preview: re }),
    };
    const [rows, total] = await Promise.all([
      this.cases
        .find(filter)
        .sort({ severityRank: 1, firstReportedAt: 1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean<(ModerationCase & { _id: Types.ObjectId })[]>()
        .exec(),
      this.cases.countDocuments(filter).exec(),
    ]);
    return { items: rows.map(toAdminReport), page: q.page, pageSize: q.pageSize, total };
  }

  private async load(id: string): Promise<ModerationCaseDocument> {
    const kase = Types.ObjectId.isValid(id) ? await this.cases.findById(id).exec() : null;
    if (!kase) throw new NotFoundException("Report not found.");
    return kase;
  }

  async detail(id: string) {
    const kase = await this.load(id);
    const [snap, reports, related, timeline] = await Promise.all([
      this.snapshot(kase.targetType, kase.targetId),
      this.reports.find({ caseId: id }).sort({ createdAt: 1 }).lean<(Report & { createdAt: Date })[]>().exec(),
      kase.authorUid ? this.cases.find({ authorUid: kase.authorUid, _id: { $ne: kase._id } }).sort({ lastReportedAt: -1 }).limit(10).lean<(ModerationCase & { _id: Types.ObjectId })[]>().exec() : [],
      Promise.all([this.audit.forTarget(kase.targetType, kase.targetId), this.audit.forTarget("report", id)]).then(([a, b]) => [...a, ...b].sort((x, y) => y.at.localeCompare(x.at))),
    ]);
    const reporterNames = await this.names(reports.map((r) => r.reporterUid));
    const author = kase.authorUid ? await this.users.findOne({ uid: kase.authorUid }).lean<User>().exec() : null;
    const hoodDoc = kase.hoodId ? (await this.hoods.findManyByIds([kase.hoodId])).get(kase.hoodId) : undefined;
    const authorHood = author?.neighborhoodId ? (await this.hoods.findManyByIds([author.neighborhoodId])).get(author.neighborhoodId) : undefined;
    return {
      ...toAdminReport(kase.toObject() as ModerationCase & { _id: Types.ObjectId }),
      content: snap?.content ?? { kind: "other", label: "This item no longer exists." },
      author: author && {
        uid: author.uid,
        displayName: author.displayName ?? "Neighbour",
        role: author.role,
        hood: authorHood ? { id: author.neighborhoodId!, name: authorHood.name } : undefined,
        verificationStatus: author.verificationStatus,
        accountStatus: author.accountStatus,
        priorActions: await this.audit.forTarget("user", author.uid),
      },
      hood: hoodDoc ? { id: kase.hoodId!, name: hoodDoc.name, city: hoodDoc.city } : undefined,
      // Staff only (this endpoint is behind admin.access). Never shown to the author.
      reports: reports.map((r) => ({ reason: r.reason, details: r.details, reporter: { uid: r.reporterUid, displayName: reporterNames.get(r.reporterUid) ?? "Neighbour" }, at: r.createdAt.toISOString() })),
      related: related.map(toAdminReport),
      timeline,
    };
  }

  async setClaim(actor: Viewer, id: string, claim: boolean): Promise<AdminReport> {
    const kase = await this.load(id);
    if (claim) {
      const updated = await this.cases
        .findOneAndUpdate(
          { _id: kase._id, $or: [{ assignee: null }, { assignee: { $exists: false } }, { "assignee.uid": actor.uid }], status: { $in: ["open", "under_review", "escalated"] } },
          { $set: { assignee: { uid: actor.uid, displayName: actor.displayName ?? "Staff" }, status: kase.status === "escalated" ? "escalated" : "under_review" } },
          { new: true },
        )
        .lean<ModerationCase & { _id: Types.ObjectId }>()
        .exec();
      if (!updated) throw new ConflictException(kase.assignee ? `${kase.assignee.displayName} is already reviewing this report.` : "This report is already closed.");
      await this.audit.record(actor, "claim", { type: "report", id, label: kase.preview.slice(0, 60) });
      return toAdminReport(updated);
    }
    const updated = await this.cases
      .findOneAndUpdate({ _id: kase._id, "assignee.uid": actor.uid }, { $set: { assignee: null, status: kase.status === "under_review" ? "open" : kase.status } }, { new: true })
      .lean<ModerationCase & { _id: Types.ObjectId }>()
      .exec();
    if (!updated) throw new ForbiddenException("Only the person reviewing it can release it.");
    return toAdminReport(updated);
  }

  /** Record and enforce a decision atomically, then notify outside the transaction. */
  async decide(actor: Viewer, id: string, input: DecisionInput): Promise<AdminReport> {
    if ((input.action === "suspend_author" || (input.restrictDays ?? 0) > 7) && !actor.capabilities.includes("moderation.suspend")) {
      throw new ForbiddenException("Only admins can do that.");
    }
    const needsAuthor = input.action === "warn_author" || input.action === "restrict_author" || input.action === "suspend_author";
    const pre = await this.load(id);
    if (pre.status === "resolved" || pre.status === "dismissed") throw new ConflictException("This report has already been decided.");
    if (needsAuthor && !pre.authorUid) throw new BadRequestException("This report has no author to act on.");
    if (input.action === "remove_content" && !REMOVABLE.includes(pre.targetType)) throw new BadRequestException("This can't be removed; act on the account instead.");

    const saved = await withTransaction(this.connection, async (session) => {
      const kase = await this.cases.findById(id).session(session).exec();
      if (!kase || kase.status === "resolved" || kase.status === "dismissed") throw new ConflictException("This report has already been decided.");

      if (input.action === "remove_content") {
        const handler = this.registry.get(kase.targetType);
        if (!handler) throw new BadRequestException("This content type can't be removed yet.");
        await handler.setRemoved(kase.targetId, true, actor.uid, session);
      }
      if (needsAuthor) {
        const map = { warn_author: "warn", restrict_author: "restrict", suspend_author: "suspend" } as const;
        await this.staffUsers.act(actor, kase.authorUid!, { action: map[input.action as keyof typeof map], reason: input.reason, note: input.note, days: input.restrictDays }, session);
      }

      if (input.action === "escalate") {
        kase.status = "escalated";
        kase.assignee = null;
      } else {
        kase.status = input.action === "keep" ? "dismissed" : "resolved";
        kase.resolution = { action: input.action, reason: input.reason, note: input.note, by: actor.displayName ?? "Staff", byUid: actor.uid, at: new Date() };
      }
      await kase.save({ session });
      if (input.action !== "warn_author" && input.action !== "restrict_author" && input.action !== "suspend_author") {
        await this.audit.record(actor, input.action, { type: kase.targetType, id: kase.targetId, label: `“${kase.preview.slice(0, 60)}”` }, { reason: input.reason, note: input.note }, session);
      }
      return kase.toObject() as ModerationCase & { _id: Types.ObjectId };
    });

    await this.afterDecision(saved, input);
    return toAdminReport(saved);
  }

  /** Author gets the public reason; reporters learn it was reviewed; nobody sees who reported. */
  private async afterDecision(kase: ModerationCase & { _id: Types.ObjectId }, input: DecisionInput) {
    if (input.action === "escalate") return;
    if (input.action === "remove_content" && kase.authorUid) {
      await this.notifications.notify({ uids: [kase.authorUid], type: "moderation", title: `Your ${kase.targetType} was removed`, body: `It broke the community guidelines: ${input.reason}. You can appeal within 30 days.`, href: "/settings/moderation" });
    }
    if (input.action === "warn_author" || input.action === "restrict_author" || input.action === "suspend_author") {
      const user = await this.users.findOne({ uid: kase.authorUid }).lean<User>().exec();
      const map = { warn_author: "warn", restrict_author: "restrict", suspend_author: "suspend" } as const;
      if (user) await this.staffUsers.tellNeighbour(user, { action: map[input.action], reason: input.reason, days: input.restrictDays });
    }
    const reporters = await this.reports.find({ caseId: String(kase._id) }).select({ reporterUid: 1 }).lean<Pick<Report, "reporterUid">[]>().exec();
    await this.notifications.notify({
      uids: reporters.map((r) => r.reporterUid),
      type: "moderation",
      title: "Thanks for your report",
      body: input.action === "keep" ? "We reviewed it and it doesn't break the guidelines. You can appeal within 30 days." : "We reviewed it and took action.",
      href: "/settings/moderation",
    });
  }

  async openCount(): Promise<{ open: number; high: number; oldest: Date | null }> {
    const active: QueryFilter<ModerationCase> = { status: { $in: ["open", "under_review", "escalated"] as CaseStatus[] } };
    const [open, high, oldest] = await Promise.all([
      this.cases.countDocuments(active).exec(),
      this.cases.countDocuments({ ...active, severity: "high" }).exec(),
      this.cases.findOne(active).sort({ firstReportedAt: 1 }).select({ firstReportedAt: 1 }).lean<Pick<ModerationCase, "firstReportedAt">>().exec(),
    ]);
    return { open, high, oldest: oldest?.firstReportedAt ?? null };
  }

  /** Median hours from first report to decision, for a time window. */
  async medianResolveHours(from: Date, to: Date): Promise<number> {
    const rows = await this.cases
      .find({ "resolution.at": { $gte: from, $lt: to } })
      .select({ firstReportedAt: 1, resolution: 1 })
      .lean<Pick<ModerationCase, "firstReportedAt" | "resolution">[]>()
      .exec();
    const hours = rows.map((r) => (r.resolution!.at.getTime() - r.firstReportedAt.getTime()) / 3_600_000).sort((a, b) => a - b);
    return hours.length ? Math.round(hours[Math.floor(hours.length / 2)]! * 10) / 10 : 0;
  }

  async openCountsByTarget(type: TargetType, ids: string[]): Promise<Map<string, number>> {
    const rows = await this.cases
      .find({ targetType: type, targetId: { $in: ids }, status: { $in: ["open", "under_review", "escalated"] } })
      .select({ targetId: 1 })
      .lean<Pick<ModerationCase, "targetId">[]>()
      .exec();
    const out = new Map<string, number>();
    for (const r of rows) out.set(r.targetId, (out.get(r.targetId) ?? 0) + 1);
    return out;
  }

  async reasonTotals(): Promise<{ reason: string; count: number }[]> {
    const rows = await this.reports.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$reason", n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
    return rows.map((r) => ({ reason: r._id, count: r.n }));
  }

  async reportsFiledBy(uid: string): Promise<number> {
    return this.reports.countDocuments({ reporterUid: uid }).exec();
  }

  private async names(uids: string[]): Promise<Map<string, string>> {
    const rows = await this.users.find({ uid: { $in: [...new Set(uids)] } }).select({ uid: 1, displayName: 1 }).lean<Pick<User, "uid" | "displayName">[]>().exec();
    return new Map(rows.map((r) => [r.uid, r.displayName ?? "Neighbour"]));
  }

  timelineFor(type: string, id: string): Promise<AuditRecord[]> {
    return this.audit.forTarget(type, id);
  }
}

export function toAdminReport(c: ModerationCase & { _id: Types.ObjectId | string }): AdminReport {
  return {
    id: String(c._id),
    target: { type: c.targetType, id: c.targetId, preview: c.preview, authorUid: c.authorUid, hoodId: c.hoodId },
    reasons: Object.entries(c.reasonCounts ?? {})
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([reason, count]) => ({ reason: reason as ReportReason, count: count ?? 0 }))
      .sort((a, b) => b.count - a.count),
    reporterCount: c.reporterCount,
    firstReportedAt: c.firstReportedAt.toISOString(),
    lastReportedAt: c.lastReportedAt.toISOString(),
    severity: c.severity,
    status: c.status,
    assignee: c.assignee ?? undefined,
    resolution: c.resolution ? { action: c.resolution.action, reason: c.resolution.reason, note: c.resolution.note, by: c.resolution.by, at: c.resolution.at.toISOString() } : undefined,
    route: c.route ?? "staff",
  };
}
