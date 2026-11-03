import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import type { Page, PageQuery } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";
import { StaffUsersService } from "../users/staff-users.service";
import { ModerationRegistry } from "./moderation-registry";
import { Appeal, ModerationCase, ModerationCaseDocument, Report, type AppealStatus, type ModerationAction } from "./moderation.schemas";

export const APPEAL_WINDOW_MS = 30 * 86_400_000;
/** Decisions a party can appeal. Escalations aren't decisions. */
const AUTHOR_APPEALABLE: ModerationAction[] = ["remove_content", "warn_author", "restrict_author", "suspend_author"];

export interface MyDecision {
  caseId: string;
  role: "author" | "reporter";
  target: { type: string; id: string; preview: string };
  action: ModerationAction;
  reason: string;
  decidedAt: string;
  canAppeal: boolean;
  appeal?: { status: AppealStatus; outcomeReason?: string; at: string };
}

export interface AdminAppeal {
  id: string;
  caseId: string;
  party: "author" | "reporter";
  by: { uid: string; displayName: string };
  reason: string;
  decision: { action: ModerationAction; reason: string; byUid: string; at: string };
  target: { type: string; id: string; preview: string };
  status: AppealStatus;
  outcome?: { reason: string; by: string; at: string };
  createdAt: string;
}

type CaseRow = ModerationCase & { _id: Types.ObjectId };
type AppealRow = Appeal & { _id: Types.ObjectId };

/**
 * Appeals on moderation decisions (Nextdoor: authors and reporters can
 * appeal). Reviewed by staff who didn't make the original decision; an
 * overturn reverses the enforcement.
 */
@Injectable()
export class AppealsService {
  constructor(
    @InjectModel(Appeal.name) private readonly appeals: Model<Appeal>,
    @InjectModel(ModerationCase.name) private readonly cases: Model<ModerationCaseDocument>,
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly registry: ModerationRegistry,
    private readonly staffUsers: StaffUsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Decisions about my content, and outcomes of my reports (last 90 days). */
  async myDecisions(viewer: Viewer): Promise<MyDecision[]> {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const reportedCaseIds = (await this.reports.find({ reporterUid: viewer.uid }).select({ caseId: 1 }).lean<Pick<Report, "caseId">[]>().exec()).map((r) => r.caseId);
    const rows = await this.cases
      .find({
        // Whatever the case's status: one reopened by a new report still carries its earlier decision, which stays appealable.
        "resolution.at": { $gte: since },
        $or: [{ authorUid: viewer.uid }, { _id: { $in: reportedCaseIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) } }],
      })
      .sort({ "resolution.at": -1 })
      .limit(50)
      .lean<CaseRow[]>()
      .exec();
    const mine = await this.appeals.find({ byUid: viewer.uid, caseId: { $in: rows.map((r) => String(r._id)) } }).lean<AppealRow[]>().exec();
    const appealOf = new Map(mine.map((a) => [a.caseId, a]));
    return rows
      .map((c): MyDecision | null => {
        const role = c.authorUid === viewer.uid ? "author" : "reporter";
        const r = c.resolution!;
        // Authors see actions against them; reporters see every outcome of their report.
        if (role === "author" && !AUTHOR_APPEALABLE.includes(r.action)) return null;
        const appeal = appealOf.get(String(c._id));
        return {
          caseId: String(c._id),
          role,
          target: { type: c.targetType, id: c.targetId, preview: c.preview },
          action: r.action,
          reason: r.reason,
          decidedAt: r.at.toISOString(),
          canAppeal: !appeal && this.appealable(c, role),
          appeal: appeal && { status: appeal.status, outcomeReason: appeal.outcome?.reason, at: (appeal.createdAt ?? new Date()).toISOString() },
        };
      })
      .filter((d): d is MyDecision => d !== null);
  }

  private appealable(c: CaseRow, role: "author" | "reporter"): boolean {
    const r = c.resolution;
    if (!r || Date.now() - r.at.getTime() > APPEAL_WINDOW_MS) return false;
    return role === "author" ? AUTHOR_APPEALABLE.includes(r.action) : r.action === "keep";
  }

  /** POST /moderation/cases/:id/appeals */
  async file(viewer: Viewer, caseId: string, reason: string): Promise<{ id: string; status: AppealStatus }> {
    const c = Types.ObjectId.isValid(caseId) ? await this.cases.findById(caseId).lean<CaseRow>().exec() : null;
    if (!c || !c.resolution) throw new NotFoundException("There's no decision to appeal.");
    const role = c.authorUid === viewer.uid ? "author" : (await this.reports.exists({ caseId, reporterUid: viewer.uid }).exec()) ? "reporter" : null;
    if (!role) throw new NotFoundException("There's no decision to appeal.");
    if (!this.appealable(c, role)) throw new BadRequestException(role === "reporter" ? "You can appeal only when we decided to keep something you reported, within 30 days." : "This decision can't be appealed any more.");
    try {
      const [a] = await this.appeals.create([
        { caseId, byUid: viewer.uid, party: role, reason: reason.trim(), decision: { action: c.resolution.action, reason: c.resolution.reason, byUid: c.resolution.byUid, at: c.resolution.at } },
      ]);
      await this.audit.record(viewer, "appeal_filed", { type: "report", id: caseId, label: c.preview.slice(0, 60) }, { reason });
      return { id: String(a!._id), status: "open" };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new ConflictException("You've already appealed this decision.");
      throw err;
    }
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  openCount(): Promise<number> {
    return this.appeals.countDocuments({ status: "open" }).exec();
  }

  async list(q: PageQuery & { status?: AppealStatus }): Promise<Page<AdminAppeal>> {
    const filter: QueryFilter<Appeal> = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([
      this.appeals.find(filter).sort({ status: 1, createdAt: 1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<AppealRow[]>().exec(),
      this.appeals.countDocuments(filter).exec(),
    ]);
    return { items: await this.toViews(rows), page: q.page, pageSize: q.pageSize, total };
  }

  async decide(actor: Viewer, id: string, outcome: "upheld" | "overturned", reason: string): Promise<AdminAppeal> {
    const appeal = Types.ObjectId.isValid(id) ? await this.appeals.findById(id).lean<AppealRow>().exec() : null;
    if (!appeal) throw new NotFoundException("Appeal not found.");
    if (appeal.status !== "open") throw new ConflictException("This appeal has already been decided.");
    if (appeal.decision.byUid === actor.uid) throw new ForbiddenException("Someone who didn't make the original decision must review this appeal.");
    const kase = await this.cases.findById(appeal.caseId).lean<CaseRow>().exec();
    if (!kase) throw new NotFoundException("The original report no longer exists.");
    const action = appeal.decision.action;
    if (outcome === "overturned" && (action === "restrict_author" || action === "suspend_author") && !actor.capabilities.includes("moderation.suspend")) {
      throw new ForbiddenException("Only admins can reverse account restrictions or suspensions.");
    }

    // A reporter's appeal against "keep" succeeding is a removal: a new decision about the author's content.
    const removesContent = outcome === "overturned" && action === "keep" && Boolean(this.registry.get(kase.targetType));
    await withTransaction(this.connection, async (session) => {
      const res = await this.appeals
        .updateOne({ _id: id, status: "open" }, { $set: { status: outcome, outcome: { reason, by: actor.displayName ?? "Staff", byUid: actor.uid, at: new Date() } } }, { session })
        .exec();
      if (!res.modifiedCount) throw new ConflictException("This appeal has already been decided.");
      if (outcome === "overturned") {
        const handler = this.registry.get(kase.targetType);
        if (action === "remove_content" && handler) await handler.setRemoved(kase.targetId, false, actor.uid, session);
        if (action === "keep" && handler) await handler.setRemoved(kase.targetId, true, actor.uid, session);
        if (removesContent) {
          // The case must say what was done and by whom: that is what the author sees, and what they appeal
          // (to someone other than the person who removed it).
          await this.cases
            .updateOne(
              { _id: kase._id },
              { $set: { status: "resolved", resolution: { action: "remove_content", reason, by: actor.displayName ?? "Staff", byUid: actor.uid, at: new Date() } }, $unset: { reopenedAt: 1 } },
              { session },
            )
            .exec();
        }
        if ((action === "restrict_author" || action === "suspend_author") && kase.authorUid) {
          await this.staffUsers.act(actor, kase.authorUid, { action: "reinstate", reason: `Appeal upheld: ${reason}` }, session);
        }
      }
      await this.audit.record(actor, outcome === "overturned" ? "appeal_overturned" : "appeal_upheld", { type: kase.targetType, id: kase.targetId, label: `“${kase.preview.slice(0, 60)}”` }, { reason }, session);
    });

    if (outcome === "overturned") {
      if (action === "remove_content" || action === "keep") await this.registry.announce(kase.targetType, kase.targetId);
      if ((action === "restrict_author" || action === "suspend_author") && kase.authorUid) this.realtime.toUser(kase.authorUid, "session.changed");
    }

    if (removesContent && kase.authorUid) {
      // The same notice as any removal (ModerationService.afterDecision): the author must hear it from us.
      await this.notifications.notify({
        uids: [kase.authorUid],
        type: "moderation",
        title: `Your ${kase.targetType} was removed`,
        body: `It broke the community guidelines: ${reason}. You can appeal within 30 days.`,
        href: "/settings/moderation",
      });
    }

    await this.notifications.notify({
      uids: [appeal.byUid],
      type: "moderation",
      title: outcome === "overturned" ? "Your appeal was successful" : "We reviewed your appeal",
      body: outcome === "overturned" ? `We've reversed the decision. ${reason}` : `The original decision stands: ${reason}`,
      href: "/settings/moderation",
    });
    return (await this.toViews([(await this.appeals.findById(id).lean<AppealRow>().exec())!]))[0]!;
  }

  private async toViews(rows: AppealRow[]): Promise<AdminAppeal[]> {
    const [users, cases] = await Promise.all([
      this.users.find({ uid: { $in: rows.map((r) => r.byUid) } }).select({ uid: 1, displayName: 1 }).lean<User[]>().exec(),
      this.cases.find({ _id: { $in: rows.map((r) => r.caseId).filter((c) => Types.ObjectId.isValid(c)) } }).lean<CaseRow[]>().exec(),
    ]);
    const name = new Map(users.map((u) => [u.uid, u.displayName ?? "Neighbour"]));
    const caseOf = new Map(cases.map((c) => [String(c._id), c]));
    return rows.map((a) => {
      const c = caseOf.get(a.caseId);
      return {
        id: String(a._id),
        caseId: a.caseId,
        party: a.party,
        by: { uid: a.byUid, displayName: name.get(a.byUid) ?? "Neighbour" },
        reason: a.reason,
        decision: { action: a.decision.action, reason: a.decision.reason, byUid: a.decision.byUid, at: new Date(a.decision.at).toISOString() },
        target: { type: c?.targetType ?? "post", id: c?.targetId ?? "", preview: c?.preview ?? "" },
        status: a.status,
        outcome: a.outcome && { reason: a.outcome.reason, by: a.outcome.by, at: new Date(a.outcome.at).toISOString() },
        createdAt: (a.createdAt ?? new Date()).toISOString(),
      };
    });
  }
}
