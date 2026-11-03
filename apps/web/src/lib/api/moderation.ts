import type { User } from "firebase/auth";
import { ApiError, apiFetch } from "./client";
import { isLive } from "./config";
import { latency } from "./mock/store";

// ── Hood Leads (volunteer moderators, Nextdoor model) ───────────────────────

export type LeadVote = "keep" | "maybe_remove" | "remove";

export interface LeadStatus {
  isLead: boolean;
  hoodId: string | null;
  /** Reports waiting for the viewer's vote. */
  waiting: number;
}

export interface LeadCase {
  id: string;
  target: { type: string; id: string; preview: string };
  /** The content as reported (kind-specific: post, comment, listing, group). */
  content: Record<string, unknown>;
  reasons: { reason: string; count: number }[];
  reporterCount: number;
  firstReportedAt: string;
  /** Votes cast so far (the split is hidden until voting ends, to avoid bias). */
  votes: number;
  myVote: LeadVote | null;
  /** After this, unresolved reports go to the myHoodora team. */
  closesAt: string;
}

/** live: GET /moderation/lead/status */
export async function getLeadStatus(user: User): Promise<LeadStatus> {
  if (isLive("moderation.leads")) return apiFetch<LeadStatus>(user, "/moderation/lead/status");
  return { isLead: false, hoodId: null, waiting: 0 };
}

/** live: GET /moderation/lead/queue (Leads only; reporters are never shown). */
export async function getLeadQueue(user: User): Promise<LeadCase[]> {
  if (isLive("moderation.leads")) return apiFetch<LeadCase[]>(user, "/moderation/lead/queue");
  await latency();
  return [];
}

/** live: POST /moderation/cases/:id/votes { vote } → { myVote, decided } */
export async function voteOnCase(user: User, caseId: string, vote: LeadVote): Promise<{ myVote: LeadVote; decided: boolean }> {
  if (isLive("moderation.leads")) {
    return apiFetch(user, `/moderation/cases/${caseId}/votes`, { method: "POST", json: { vote } });
  }
  await latency(200);
  return { myVote: vote, decided: false };
}

// ── Your decisions & appeals ────────────────────────────────────────────────

export type ModerationActionType = "keep" | "remove_content" | "warn_author" | "restrict_author" | "suspend_author" | "escalate";

export interface MyDecision {
  caseId: string;
  /** "author": about your content · "reporter": the outcome of your report. */
  role: "author" | "reporter";
  target: { type: string; id: string; preview: string };
  action: ModerationActionType;
  reason: string;
  decidedAt: string;
  canAppeal: boolean;
  appeal?: { status: "open" | "upheld" | "overturned"; outcomeReason?: string; at: string };
}

/** live: GET /moderation/my-decisions (last 90 days) */
export async function getMyDecisions(user: User): Promise<MyDecision[]> {
  if (isLive("moderation.appeals")) return apiFetch<MyDecision[]>(user, "/moderation/my-decisions");
  await latency();
  return [];
}

/** live: POST /moderation/cases/:id/appeals { reason } — once per decision, within 30 days. */
export async function fileAppeal(user: User, caseId: string, reason: string): Promise<void> {
  if (isLive("moderation.appeals")) {
    await apiFetch(user, `/moderation/cases/${caseId}/appeals`, { method: "POST", json: { reason } });
    return;
  }
  await latency(300);
  if (reason.trim().length < 10) throw new ApiError("Tell us a little more (at least 10 characters).", 400, "client");
}
