import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { REPORT_REASONS, type ReportReason, type Severity } from "../platform/platform-settings.schema";
import { TARGET_TYPES, type TargetType } from "./moderation-registry";

/** One neighbour's report. Private: the reporter is never shown to the author. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "reports" })
export class Report {
  @Prop({ required: true, enum: TARGET_TYPES }) targetType!: TargetType;
  @Prop({ required: true }) targetId!: string;
  @Prop({ required: true, index: true }) reporterUid!: string;
  @Prop({ required: true, enum: REPORT_REASONS }) reason!: ReportReason;
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
  @Prop({ required: true, enum: TARGET_TYPES }) targetType!: TargetType;
  @Prop({ required: true }) targetId!: string;
  @Prop({ index: true }) hoodId?: string;
  @Prop({ index: true }) authorUid?: string;
  @Prop({ maxlength: 200 }) preview!: string;
  @Prop({ type: Object, default: () => ({}) }) reasonCounts!: Partial<Record<ReportReason, number>>;
  @Prop({ default: 0 }) reporterCount!: number;
  @Prop({ required: true, enum: ["high", "medium", "low"], index: true }) severity!: Severity;
  /** 1 high · 2 medium · 3 low — for sorting. */
  @Prop({ required: true }) severityRank!: number;
  /** "staff" for account reports and high-risk reasons; "leads" reserved for Hood Lead voting. */
  @Prop({ required: true, enum: ["staff", "leads"], default: "staff" }) route!: "staff" | "leads";
  @Prop({ required: true, enum: CASE_STATUSES, default: "open", index: true }) status!: CaseStatus;
  @Prop({ type: { uid: String, displayName: String }, _id: false }) assignee?: { uid: string; displayName: string } | null;
  @Prop({ required: true }) firstReportedAt!: Date;
  @Prop({ required: true }) lastReportedAt!: Date;
  @Prop({
    type: { action: String, reason: String, note: String, by: String, byUid: String, at: Date },
    _id: false,
  })
  resolution?: { action: ModerationAction; reason: string; note?: string; by: string; byUid: string; at: Date } | null;
}
export const ModerationCaseSchema = SchemaFactory.createForClass(ModerationCase);
ModerationCaseSchema.index({ targetType: 1, targetId: 1 }, { unique: true });
ModerationCaseSchema.index({ status: 1, severityRank: 1, firstReportedAt: 1 });
