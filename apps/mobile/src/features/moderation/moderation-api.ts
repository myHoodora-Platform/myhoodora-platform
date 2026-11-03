import type { User } from "@firebase/auth";
import type { LeadCase, LeadStatus, LeadVote, ModerationActionType, MyDecision } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

/**
 * Neighbour-side moderation, as on the web (contract §15): Hood Leads vote on reports from their
 * neighbourhood; everyone sees decisions about their content and their reports, and can appeal.
 */
export const moderationKeys = {
  leadStatus: ["moderation", "lead-status"] as const,
  queue: ["moderation", "lead-queue"] as const,
  decisions: ["moderation", "my-decisions"] as const,
};

export const getLeadStatus = (user: User) => apiFetch<LeadStatus>(user, "/moderation/lead/status");
export const getLeadQueue = (user: User) => apiFetch<LeadCase[]>(user, "/moderation/lead/queue");
/** Three votes with a two-thirds majority decide; `decided` says this vote settled it. */
export const voteOnCase = (user: User, caseId: string, vote: LeadVote) =>
  apiFetch<{ myVote: LeadVote; decided: boolean }>(user, `/moderation/cases/${caseId}/votes`, { method: "POST", json: { vote } });
export const getMyDecisions = (user: User) => apiFetch<MyDecision[]>(user, "/moderation/my-decisions");
/** Once per decision, within 30 days; 10 to 1,000 characters. */
export const fileAppeal = (user: User, caseId: string, reason: string) => apiFetch<void>(user, `/moderation/cases/${caseId}/appeals`, { method: "POST", json: { reason } });

export const APPEAL_MIN = 10;
export const APPEAL_MAX = 1000;

export const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  misinformation: "Misinformation",
  scam: "Scam",
  not_local: "Not about the neighbourhood",
  other: "Something else",
};

export const VOTES: { id: LeadVote; label: string; hint: string }[] = [
  { id: "keep", label: "Keep", hint: "It's within the guidelines" },
  { id: "maybe_remove", label: "Not sure", hint: "Borderline" },
  { id: "remove", label: "Remove", hint: "It breaks the guidelines" },
];

export const ACTION_LABEL: Record<ModerationActionType, string> = {
  keep: "Kept: it doesn't break the guidelines",
  remove_content: "Removed",
  warn_author: "Warning",
  restrict_author: "Account restricted",
  suspend_author: "Account suspended",
  escalate: "Sent to the myHoodora team",
};

export const APPEAL_LABEL: Record<NonNullable<MyDecision["appeal"]>["status"], string> = {
  open: "Appeal under review",
  upheld: "Appeal reviewed: the decision stands",
  overturned: "Appeal successful: the decision was reversed",
};

/** What was reported, readable for any kind of item. */
export function caseText(c: LeadCase): { title: string; body: string } {
  const k = c.content;
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  if (k.kind === "post") return { title: "Post", body: str(k.message, c.target.preview) };
  if (k.kind === "comment") return { title: "Comment", body: str(k.message, c.target.preview) };
  if (k.kind === "listing") return { title: `Listing · ${str(k.title, "")}`, body: str(k.description, c.target.preview) };
  if (k.kind === "group") return { title: `Group · ${str(k.name, "")}`, body: str(k.description, c.target.preview) };
  return { title: c.target.type.charAt(0).toUpperCase() + c.target.type.slice(1), body: c.target.preview };
}

/** "5 hours left" until voting closes and the team decides. */
export function hoursLeft(closesAt: string, now = Date.now()): string {
  const h = Math.max(0, Math.round((new Date(closesAt).getTime() - now) / 3_600_000));
  return h <= 1 ? "Less than an hour left" : `${h} hours left`;
}

/** The queue after a vote: gone once decided, otherwise marked with your vote (counted once). */
export function afterVote(cases: LeadCase[], caseId: string, vote: LeadVote, decided: boolean): LeadCase[] {
  if (decided) return cases.filter((c) => c.id !== caseId);
  return cases.map((c) => (c.id === caseId ? { ...c, myVote: vote, votes: c.myVote ? c.votes : c.votes + 1 } : c));
}
