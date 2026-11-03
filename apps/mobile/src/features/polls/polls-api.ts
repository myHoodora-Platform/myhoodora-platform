import type { User } from "@firebase/auth";
import type { PollDefinition, PollResults } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

/** Vote, change your vote (`optionId`), or take it back (`null`). 410 once the poll has closed. */
export function votePoll(user: User, postId: string, optionId: string | null): Promise<PollResults> {
  return optionId
    ? apiFetch<PollResults>(user, `/posts/${postId}/poll/vote`, { method: "PUT", json: { optionId } })
    : apiFetch<PollResults>(user, `/posts/${postId}/poll/vote`, { method: "DELETE" });
}

/** The results after moving your vote, shown before the API replies. */
export function withVote(r: PollResults, to: string | null): PollResults {
  const counts = { ...r.counts };
  if (r.myVote) counts[r.myVote] = Math.max(0, (counts[r.myVote] ?? 0) - 1);
  if (to) counts[to] = (counts[to] ?? 0) + 1;
  const total = Math.max(0, r.total - (r.myVote ? 1 : 0) + (to ? 1 : 0));
  return { ...r, counts, total, myVote: to };
}

export const isPollClosed = (poll: PollDefinition, results?: PollResults, now = Date.now()) => !!results?.closed || new Date(poll.closesAt).getTime() <= now;

/** "3 days left", "5 hours left", "Ends soon", "Final results". */
export function timeLeft(closesAt: string, now = Date.now()): string {
  const ms = new Date(closesAt).getTime() - now;
  if (!(ms > 0)) return "Final results";
  // Rounded to the nearest day, so a 3-day poll just posted reads "3 days left", not 2.
  const days = Math.round(ms / 86_400_000);
  if (days >= 2) return `${days} days left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 20) return "1 day left";
  if (hours >= 2) return `${hours} hours left`;
  return "Ends soon";
}

/** Whole percentages that add up to 100 (largest remainder), so the bars never read 33/33/33. */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    floors[i]! += 1;
  }
  return floors;
}

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
/** How long a poll stays open, as Nextdoor offers. */
export const POLL_LENGTHS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
];
