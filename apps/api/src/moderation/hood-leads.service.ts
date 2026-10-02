import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import type { Viewer } from "../shared/auth/viewer";
import { LeadsRosterService } from "./leads-roster.service";
import { ModerationService } from "./moderation.service";
import { LeadVote, ModerationCase, ModerationCaseDocument, Report, type LeadVoteValue } from "./moderation.schemas";

/** Consensus rule (Nextdoor Leads): ≥ 3 votes and a two-thirds majority. */
export const MIN_VOTES = 3;
export const MAJORITY = 2 / 3;
export const ESCALATE_AFTER_MS = 48 * 3_600_000;

/** Acts for the Leads when their votes reach consensus (audited as such). */
export const HOOD_LEADS_ACTOR: Viewer = {
  uid: "system:hood-leads",
  displayName: "Hood Leads (consensus)",
  role: "moderator",
  accountStatus: "active",
  verificationStatus: "verified",
  emailVerified: true,
  hoodId: null,
  capabilities: ["moderation.act"],
  exists: true,
};

export interface LeadCaseView {
  id: string;
  target: { type: string; id: string; preview: string };
  content: Record<string, unknown>;
  reasons: { reason: string; count: number }[];
  reporterCount: number;
  firstReportedAt: string;
  votes: number;
  myVote: LeadVoteValue | null;
  closesAt: string;
}

type CaseRow = ModerationCase & { _id: Types.ObjectId };

@Injectable()
export class HoodLeadsService {
  constructor(
    @InjectModel(ModerationCase.name) private readonly cases: Model<ModerationCaseDocument>,
    @InjectModel(LeadVote.name) private readonly votes: Model<LeadVote>,
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    private readonly roster: LeadsRosterService,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  /** No consensus within 48 h → staff. Run lazily whenever a queue is read (no scheduler needed). */
  async escalateStale(): Promise<number> {
    const stale = await this.cases
      .find({ route: "leads", status: { $in: ["open", "under_review"] }, routedToLeadsAt: { $lt: new Date(Date.now() - ESCALATE_AFTER_MS) } })
      .lean<CaseRow[]>()
      .exec();
    for (const c of stale) {
      const res = await this.cases.updateOne({ _id: c._id, route: "leads" }, { $set: { route: "staff", status: "escalated" } }).exec();
      if (res.modifiedCount) await this.audit.record(HOOD_LEADS_ACTOR, "escalate", { type: c.targetType, id: c.targetId, label: `“${c.preview.slice(0, 60)}”` }, { reason: "No Lead consensus within 48 hours" });
    }
    return stale.length;
  }

  async status(viewer: Viewer): Promise<{ isLead: boolean; hoodId: string | null; waiting: number }> {
    const isLead = await this.roster.isActiveLead(viewer.uid, viewer.hoodId);
    if (!isLead) return { isLead: false, hoodId: viewer.hoodId, waiting: 0 };
    return { isLead, hoodId: viewer.hoodId, waiting: (await this.queue(viewer)).length };
  }

  private async requireLead(viewer: Viewer): Promise<string> {
    if (!(await this.roster.isActiveLead(viewer.uid, viewer.hoodId))) throw new ForbiddenException("Only Hood Leads can review reports.");
    return viewer.hoodId!;
  }

  /** Cases in my Hood waiting for Lead votes (not my content, not ones I reported). */
  async queue(viewer: Viewer): Promise<LeadCaseView[]> {
    const hoodId = await this.requireLead(viewer);
    await this.escalateStale();
    const rows = await this.cases
      .find({ route: "leads", hoodId, status: { $in: ["open", "under_review"] }, authorUid: { $ne: viewer.uid } })
      .sort({ severityRank: 1, firstReportedAt: 1 })
      .limit(100)
      .lean<CaseRow[]>()
      .exec();
    const ids = rows.map((r) => String(r._id));
    const [mine, reported] = await Promise.all([
      this.votes.find({ caseId: { $in: ids }, uid: viewer.uid }).lean<LeadVote[]>().exec(),
      this.reports.find({ caseId: { $in: ids }, reporterUid: viewer.uid }).select({ caseId: 1 }).lean<Pick<Report, "caseId">[]>().exec(),
    ]);
    const skip = new Set(reported.map((r) => r.caseId));
    return this.toViews(rows.filter((r) => !skip.has(String(r._id))), new Map(mine.map((v) => [v.caseId, v.vote])));
  }

  async vote(viewer: Viewer, caseId: string, vote: LeadVoteValue): Promise<{ myVote: LeadVoteValue; decided: boolean }> {
    const hoodId = await this.requireLead(viewer);
    const kase = Types.ObjectId.isValid(caseId) ? await this.cases.findById(caseId).lean<CaseRow>().exec() : null;
    if (!kase || kase.hoodId !== hoodId || kase.route !== "leads") throw new NotFoundException("This report isn't in your Hood's queue.");
    if (!["open", "under_review"].includes(kase.status)) throw new ConflictException("Voting on this report has closed.");
    if (kase.authorUid === viewer.uid) throw new ForbiddenException("You can't vote on your own content.");
    if (await this.reports.exists({ caseId, reporterUid: viewer.uid }).exec()) throw new ForbiddenException("You reported this, so you can't vote on it.");

    await this.votes.updateOne({ caseId, uid: viewer.uid }, { $set: { vote } }, { upsert: true }).exec();
    return { myVote: vote, decided: await this.tally(kase) };
  }

  /** Apply consensus through the one enforcement path (ModerationService.decide). */
  private async tally(kase: CaseRow): Promise<boolean> {
    const all = await this.votes.find({ caseId: String(kase._id) }).lean<LeadVote[]>().exec();
    if (all.length < MIN_VOTES) return false;
    const remove = all.filter((v) => v.vote === "remove").length / all.length;
    const keep = all.filter((v) => v.vote === "keep").length / all.length;
    const action = remove >= MAJORITY ? "remove_content" : keep >= MAJORITY ? "keep" : null;
    if (!action) return false;
    try {
      await this.moderation.decide(HOOD_LEADS_ACTOR, String(kase._id), {
        action,
        reason: action === "remove_content" ? "Hood Leads agreed it breaks the community guidelines" : "Hood Leads agreed it doesn't break the guidelines",
        note: `${all.length} votes: ${all.filter((v) => v.vote === "remove").length} remove, ${all.filter((v) => v.vote === "maybe_remove").length} maybe, ${all.filter((v) => v.vote === "keep").length} keep`,
      });
      return true;
    } catch (err) {
      if (err instanceof ConflictException) return true; // Staff (or a parallel vote) already decided it.
      throw err;
    }
  }

  /** Staff view of the votes on a case. */
  async votesFor(caseId: string) {
    const all = await this.votes.find({ caseId }).lean<LeadVote[]>().exec();
    return {
      total: all.length,
      remove: all.filter((v) => v.vote === "remove").length,
      maybe_remove: all.filter((v) => v.vote === "maybe_remove").length,
      keep: all.filter((v) => v.vote === "keep").length,
    };
  }

  private async toViews(rows: CaseRow[], mine: Map<string, LeadVoteValue>): Promise<LeadCaseView[]> {
    const ids = rows.map((r) => String(r._id));
    const counts = await this.votes.aggregate<{ _id: string; n: number }>([{ $match: { caseId: { $in: ids } } }, { $group: { _id: "$caseId", n: { $sum: 1 } } }]);
    const byCase = new Map(counts.map((c) => [c._id, c.n]));
    const out: LeadCaseView[] = [];
    for (const c of rows) {
      const snap = await this.moderation.snapshot(c.targetType, c.targetId);
      if (!snap) continue;
      out.push({
        id: String(c._id),
        target: { type: c.targetType, id: c.targetId, preview: c.preview },
        content: snap.content,
        reasons: Object.entries(c.reasonCounts ?? {})
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([reason, count]) => ({ reason, count: count ?? 0 })),
        reporterCount: c.reporterCount,
        firstReportedAt: c.firstReportedAt.toISOString(),
        votes: byCase.get(String(c._id)) ?? 0,
        myVote: mine.get(String(c._id)) ?? null,
        closesAt: new Date((c.routedToLeadsAt ?? c.firstReportedAt).getTime() + ESCALATE_AFTER_MS).toISOString(),
      });
    }
    return out;
  }
}

