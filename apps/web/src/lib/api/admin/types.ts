/**
 * Admin API types — mirror docs/api-contract.md §13 exactly. When the
 * backend ships an endpoint, these shapes are what it must return.
 */
import type { ReportReason } from "../types";

// ── Shared ──────────────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  /** "field:asc" | "field:desc" */
  sort?: string;
}

/** Owners are admins who can also appoint admins (and other owners). */
export type AdminRole = "moderator" | "admin" | "owner";

export type Capability =
  | "moderation.act"
  | "moderation.suspend"
  | "verification.review"
  | "hoods.manage"
  | "businesses.review"
  | "broadcasts.send"
  | "team.manage"
  | "settings.manage"
  /** Owner only: grant or revoke admin/owner. */
  | "team.manage.admins";

export interface AdminSession {
  uid: string;
  displayName: string;
  role: AdminRole;
  can: Capability[];
  /** Mock mode only: the role is a local preview, not a real permission. */
  preview?: boolean;
}

export interface Trend {
  value: number;
  previous: number;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export type ModerationAction = "keep" | "remove_content" | "warn_author" | "restrict_author" | "suspend_author" | "escalate";

export type AuditAction =
  | ModerationAction
  | "restore_content"
  | "verify"
  | "reject_verification"
  | "change_hood"
  | "warn"
  | "restrict"
  | "suspend"
  | "reinstate"
  | "hood_create"
  | "hood_update"
  | "hood_archive"
  | "business_approve"
  | "business_request_info"
  | "business_reject"
  | "business_suspend"
  | "broadcast_send"
  | "role_change"
  | "alert_end"
  | "alert_downgrade"
  | "inbox_reply"
  | "inbox_start"
  | "claim"
  | "settings_update"
  | "lead_appoint"
  | "lead_remove"
  | "appeal_filed"
  | "appeal_upheld"
  | "appeal_overturned"
  | "business_claim"
  | "hood_request"
  | "hood_request_cancel"
  | "hood_self_change";

export interface AuditEvent {
  id: string;
  at: string;
  actor: { uid: string; displayName: string; role: string };
  action: AuditAction;
  target: { type: string; id: string; label: string };
  reason?: string;
  note?: string;
}

// ── Moderation ──────────────────────────────────────────────────────────────

export type ReportStatus = "open" | "under_review" | "escalated" | "resolved" | "dismissed";
export type ReportSeverity = "high" | "medium" | "low";
export type ReportTargetType = "post" | "comment" | "listing" | "message" | "user" | "group" | "business";

export interface AdminReport {
  id: string;
  target: { type: ReportTargetType; id: string; preview: string; authorUid?: string; hoodId?: string };
  reasons: { reason: ReportReason; count: number }[];
  reporterCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  severity: ReportSeverity;
  status: ReportStatus;
  assignee?: { uid: string; displayName: string };
  resolution?: { action: ModerationAction; reason: string; note?: string; by: string; at: string };
  /** "leads" while volunteer Hood Leads are voting on it (staff can still decide). */
  route?: "staff" | "leads";
}

export interface ReportDetail extends AdminReport {
  content: ReportedContent;
  /** Hood Lead votes so far (the split is only shown to staff). */
  leadVotes?: { total: number; remove: number; maybe_remove: number; keep: number };
  author?: NeighbourSummary & { priorActions: AuditEvent[] };
  hood?: { id: string; name: string; city: string };
  reports: { reason: ReportReason; details?: string; reporter: { uid: string; displayName: string }; at: string }[];
  related: AdminReport[];
  timeline: AuditEvent[];
}

export type ReportedContent =
  | { kind: "post"; message: string; category: string; createdAt: string; media: string[]; urgent?: boolean; removed: boolean }
  | { kind: "comment"; message: string; createdAt: string; onPost: { id: string; message: string }; removed: boolean }
  | { kind: "listing"; title: string; description: string; priceNaira: number | null; createdAt: string; removed: boolean }
  | { kind: "user"; displayName: string; bio?: string }
  | { kind: "other"; label: string };

export interface ModerationActionInput {
  action: ModerationAction;
  reason: string;
  note?: string;
  restrictDays?: number;
}

// ── Neighbours ──────────────────────────────────────────────────────────────

export type VerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";
export type AccountStatus = "active" | "restricted" | "suspended";

export interface NeighbourSummary {
  uid: string;
  displayName: string;
  role: "member" | AdminRole;
  hood?: { id: string; name: string };
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
}

export interface AdminNeighbour extends NeighbourSummary {
  email: string;
  photoURL?: string;
  restrictedUntil?: string;
  joinedAt: string;
  lastActiveAt?: string;
  counts: { posts: number; reportsAgainst: number; reportsFiled: number };
}

export interface VerificationAttempt {
  at: string;
  address: string;
  point: { lat: number; lng: number };
  result: "matched" | "outside_coverage" | "low_accuracy" | "mismatch";
}

export interface NeighbourDetail extends AdminNeighbour {
  location?: { address: string; lat: number; lng: number };
  verificationAttempts: VerificationAttempt[];
  timeline: AuditEvent[];
}

export type NeighbourAction = "verify" | "reject_verification" | "change_hood" | "warn" | "restrict" | "suspend" | "reinstate";

export interface NeighbourActionInput {
  action: NeighbourAction;
  hoodId?: string;
  days?: number;
  reason: string;
  note?: string;
}

export interface VerificationCase {
  uid: string;
  displayName: string;
  submittedAt: string;
  address: string;
  point: { lat: number; lng: number };
  nearestHoods: { id: string; name: string; distanceMeters: number }[];
  attempts: number;
  lastError?: "outside_coverage" | "low_accuracy" | "mismatch";
  status: "pending_review" | "failed";
  /** The nearby Hood they asked to join (contract §16); approve into this one. */
  requestedHood?: { id: string; name: string };
}

// ── Hoods ───────────────────────────────────────────────────────────────────

export type HoodStatus = "active" | "paused" | "archived";

/** Where a Hood is: GET /admin/hoods/near, for drawing the Hoods around a point. */
export interface HoodFootprint {
  id: string;
  name: string;
  city: string;
  status: HoodStatus;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

export interface AdminHood {
  id: string;
  name: string;
  city: string;
  country: string;
  description?: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  status: HoodStatus;
  stats: { members: number; verifiedPct: number; posts7d: number; openReports: number; growth7d: number };
  createdAt: string;
}

export interface HoodDetail extends AdminHood {
  members7d: { day: string; members: number }[];
  timeline: AuditEvent[];
}

export interface CreateHoodInput {
  name: string;
  city: string;
  country: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  description?: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export interface AdminPost {
  id: string;
  message: string;
  category: string;
  urgent?: boolean;
  author: { uid: string; displayName: string };
  hood?: { id: string; name: string };
  createdAt: string;
  status: "visible" | "removed";
  reactions: number;
  comments: number;
  openReports: number;
}

export interface AdminComment {
  id: string;
  message: string;
  author: { uid: string; displayName: string };
  createdAt: string;
  status: "visible" | "removed";
}

export interface PostDetail extends AdminPost {
  media: string[];
  commentsList: AdminComment[];
  reports: AdminReport[];
  timeline: AuditEvent[];
  alertCategory?: string;
}

export interface AdminListing {
  id: string;
  title: string;
  priceNaira: number | null;
  category: string;
  seller: { uid: string; displayName: string };
  hood?: { id: string; name: string };
  createdAt: string;
  status: "active" | "sold" | "removed";
  openReports: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  privacy: string;
  category: string;
  members: number;
  official: boolean;
  hood?: { id: string; name: string };
  createdAt: string;
  status: "active" | "archived";
  openReports: number;
}

// ── Businesses ──────────────────────────────────────────────────────────────

export type BusinessStatus = "applied" | "info_requested" | "verified" | "rejected" | "suspended";

export interface AdminBusiness {
  id: string;
  name: string;
  category: string;
  owner: { name: string; email: string; phone: string };
  areasServed: string[];
  status: BusinessStatus;
  cacNumber?: string;
  appliedAt: string;
  openReports: number;
}

export interface BusinessDetail extends AdminBusiness {
  description: string;
  address?: string;
  checks: { phone: "verified" | "pending" | "failed"; cac: "matched" | "not_provided" | "pending" | "mismatch" };
  wantsAdsUpdates: boolean;
  timeline: AuditEvent[];
}

// ── Inbox & broadcasts ──────────────────────────────────────────────────────

export type InboxStatus = "open" | "waiting" | "resolved";

export interface InboxThread {
  id: string;
  /** "staff": a conversation a team member started with a neighbour. */
  source: "in_app" | "contact_form" | "feedback" | "staff";
  topic: string;
  subject: string;
  from: { uid?: string; name: string; email: string };
  status: InboxStatus;
  priority: "low" | "normal" | "high";
  assignee?: { uid: string; displayName: string };
  messages: { from: "user" | "staff"; body: string; at: string; by?: string }[];
  createdAt: string;
  updatedAt: string;
}

export type BroadcastAudience = { type: "all" } | { type: "hood"; hoodIds: string[] } | { type: "user"; uids: string[] };

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  audienceLabel: string;
  reach: number;
  sentAt: string;
  sentBy: string;
  /** Delivery runs after the request, in batches. Absent (older rows, preview) means sent. */
  status?: "sending" | "sent" | "failed";
  /** Notifications written so far (equals `reach` once sent). */
  delivered?: number;
}

// ── Insights, team, settings ────────────────────────────────────────────────

export interface Insights {
  signups: { day: string; count: number }[];
  verifiedFunnel: { started: number; verified: number; failed: number };
  activeByHood: { hood: string; members: number; posts7d: number }[];
  reportsByReason: { reason: string; count: number }[];
  medianResolveHours: number | null;
  kindnessPrompts: number | null;
}

export interface AdminOverview {
  attention: {
    openReports: number;
    urgentReports: number;
    oldestOpenReportAt: string | null;
    pendingVerifications: number;
    businessApplications: number;
    unansweredInbox: number;
    liveUrgentAlerts: number;
    /** Appeals waiting for a reviewer. */
    openAppeals?: number;
  };
  pulse: { newNeighbours: Trend; posts: Trend; activeHoods: Trend; medianResolveHours: Trend };
  recentActions: AuditEvent[];
}

export interface PlatformSettings {
  reportReasons: { id: string; label: string; severity: ReportSeverity; staffOnly: boolean }[];
  coverageCities: { city: string; hoods: number }[];
}

export interface SignupEntry {
  id: string;
  type: "ai_pilot" | "talent";
  name: string;
  email: string;
  detail: string;
  at: string;
}

// ── Hood Leads & appeals ────────────────────────────────────────────────────

export interface HoodLead {
  uid: string;
  displayName: string;
  photoURL?: string;
  since: string;
}

export type AppealStatus = "open" | "upheld" | "overturned";

export interface AdminAppeal {
  id: string;
  caseId: string;
  /** "author": about their own content/account · "reporter": we kept something they reported. */
  party: "author" | "reporter";
  by: { uid: string; displayName: string };
  reason: string;
  decision: { action: ModerationAction; reason: string; byUid: string; at: string };
  target: { type: string; id: string; preview: string };
  status: AppealStatus;
  outcome?: { reason: string; by: string; at: string };
  createdAt: string;
}
