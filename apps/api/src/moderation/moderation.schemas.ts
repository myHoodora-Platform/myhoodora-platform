import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { REPORT_REASONS, type ReportReason, type Severity } from "../platform/platform-settings.schema";
import { TARGET_TYPES, type TargetType } from "./moderation-registry";

/** One neighbour's report. Private: the reporter is never shown to the author. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "reports" })
export class Report {
  @Prop({ type: String, required: true, enum: TARGET_TYPES }) targetType!: TargetType;
  @Prop({ required: true }) targetId!: string;
  @Prop({ required: true, index: true }) reporterUid!: string;
  /** Who the report is about: the author, or for a conversation the other person in it. */
  @Prop() reportedUid?: string;
  @Prop({ type: String, required: true, enum: REPORT_REASONS }) reason!: ReportReason;
  @Prop({ maxlength: 1000 }) details?: string;
  @Prop({ required: true, index: true }) caseId!: string;
  createdAt?: Date;
}
export const ReportSchema = SchemaFactory.createForClass(Report);
// One report per person per item.
ReportSchema.index({ reporterUid: 1, targetType: 1, targetId: 1 }, { unique: true });

export const CASE_STATUSES = ["open", "under_review", "escalated", "resolved", "dismissed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const MODERATION_ACTIONS = ["keep", "remove_content", "warn_author", "restrict_author", "suspend_author", "escalate"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export type ModerationCaseDocument = HydratedDocument<ModerationCase>;

/**
 * Everything reported about one item, grouped. The queue and the §13.2
 * `AdminReport` are views of this. Hood Lead votes and appeals attach here.
 */
@Schema({ timestamps: true, collection: "moderation_cases" })
export class ModerationCase {
  @Prop({ type: String, required: true, enum: TARGET_TYPES }) targetType!: TargetType;
  @Prop({ required: true }) targetId!: string;
  @Prop({ index: true }) hoodId?: string;
  @Prop({ index: true }) authorUid?: string;
  @Prop({ maxlength: 200 }) preview!: string;
  @Prop({ type: Object, default: () => ({}) }) reasonCounts!: Partial<Record<ReportReason, number>>;
  @Prop({ default: 0 }) reporterCount!: number;
  @Prop({ type: String, required: true, enum: ["high", "medium", "low"], index: true }) severity!: Severity;
  /** 1 high · 2 medium · 3 low — for sorting. */
  @Prop({ required: true }) severityRank!: number;
  /** "staff" for account reports and high-risk reasons; "leads" = decided by Hood Lead votes. */
  @Prop({ type: String, required: true, enum: ["staff", "leads"], default: "staff" }) route!: "staff" | "leads";
  @Prop({ type: String, required: true, enum: CASE_STATUSES, default: "open", index: true }) status!: CaseStatus;
  @Prop({ type: { uid: String, displayName: String }, _id: false }) assignee?: { uid: string; displayName: string } | null;
  @Prop({ required: true }) firstReportedAt!: Date;
  @Prop({ required: true }) lastReportedAt!: Date;
  @Prop({
    type: { action: String, reason: String, note: String, by: String, byUid: String, at: Date },
    _id: false,
  })
  resolution?: { action: ModerationAction; reason: string; note?: string; by: string; byUid: string; at: Date } | null;
  /** When the case went to Hood Leads (for the 48 h escalation). */
  @Prop() routedToLeadsAt?: Date;
  /**
   * When a new report brought an already-decided case back to the queue. `resolution` then still
   * holds the earlier decision (it stays appealable) until staff decide again.
   */
  @Prop() reopenedAt?: Date;
}
export const ModerationCaseSchema = SchemaFactory.createForClass(ModerationCase);
ModerationCaseSchema.index({ targetType: 1, targetId: 1 }, { unique: true });
ModerationCaseSchema.index({ status: 1, severityRank: 1, firstReportedAt: 1 });

// ── Hood Leads (volunteer moderators per Hood, Nextdoor model) ──────────────

/** A neighbour appointed as a Lead for their Hood. Separate from users.role. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "hood_roles" })
export class HoodRole {
  @Prop({ required: true, index: true }) hoodId!: string;
  @Prop({ required: true, index: true }) uid!: string;
  @Prop({ type: String, required: true, enum: ["lead"], default: "lead" }) role!: "lead";
  @Prop({ required: true }) appointedBy!: string;
  createdAt?: Date;
}
export const HoodRoleSchema = SchemaFactory.createForClass(HoodRole);
HoodRoleSchema.index({ hoodId: 1, uid: 1 }, { unique: true });

export const LEAD_VOTES = ["keep", "maybe_remove", "remove"] as const;
export type LeadVoteValue = (typeof LEAD_VOTES)[number];

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "lead_votes" })
export class LeadVote {
  @Prop({ required: true, index: true }) caseId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ type: String, required: true, enum: LEAD_VOTES }) vote!: LeadVoteValue;
  createdAt?: Date;
}
export const LeadVoteSchema = SchemaFactory.createForClass(LeadVote);
LeadVoteSchema.index({ caseId: 1, uid: 1 }, { unique: true });

// ── Appeals ─────────────────────────────────────────────────────────────────

export const APPEAL_STATUSES = ["open", "upheld", "overturned"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

/** One appeal per party per decision; reviewed by staff who didn't decide it. */
@Schema({ timestamps: true, collection: "appeals" })
export class Appeal {
  @Prop({ required: true, index: true }) caseId!: string;
  @Prop({ required: true }) byUid!: string;
  @Prop({ type: String, required: true, enum: ["author", "reporter"] }) party!: "author" | "reporter";
  @Prop({ required: true, maxlength: 1000 }) reason!: string;
  /** The decision being appealed (copied so later changes don't alter it). */
  @Prop({ type: Object, required: true }) decision!: { action: ModerationAction; reason: string; byUid: string; at: Date };
  @Prop({ type: String, required: true, enum: APPEAL_STATUSES, default: "open", index: true }) status!: AppealStatus;
  @Prop({ type: Object }) outcome?: { reason: string; by: string; byUid: string; at: Date };
  createdAt?: Date;
}
export const AppealSchema = SchemaFactory.createForClass(Appeal);
AppealSchema.index({ caseId: 1, byUid: 1 }, { unique: true });
