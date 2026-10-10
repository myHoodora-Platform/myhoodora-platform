import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, update } from "./mock/store";
import { seedPollVotes } from "./mock/seed";
import type { PollResults, Post } from "./types";

/** postId → voter uid → optionId. Mock only; the real API never exposes voters. */
type VoteBook = Record<string, Record<string, string>>;
const KEY = "poll-votes";

export function isPollClosed(post: Post, now = Date.now()): boolean {
  return !!post.meta.poll && new Date(post.meta.poll.closesAt).getTime() <= now;
}

function summarise(post: Post, votes: Record<string, string>, viewerUid: string): PollResults {
  const counts: Record<string, number> = {};
  for (const o of post.meta.poll?.options ?? []) counts[o.id] = 0;
  for (const optionId of Object.values(votes)) {
    if (optionId in counts) counts[optionId] = (counts[optionId] ?? 0) + 1;
  }
  return {
    postId: post._id,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    myVote: votes[viewerUid] ?? null,
    closed: isPollClosed(post),
  };
}

/** live: GET /posts/:id/poll → PollResults (viewer-relative myVote). */
export async function getPollResults(user: User, post: Post): Promise<PollResults> {
  if (isLive("polls")) return apiFetch<PollResults>(user, `/posts/${post._id}/poll`);
  await latency(120);
  return summarise(post, load<VoteBook>(KEY, seedPollVotes)[post._id] ?? {}, user.uid);
}

/**
 * live: PUT /posts/:id/poll/vote { optionId } → PollResults.
 * Casts or changes the viewer's vote while the poll is open (410 once closed).
 */
export async function votePoll(user: User, post: Post, optionId: string): Promise<PollResults> {
  if (isLive("polls")) {
    return apiFetch<PollResults>(user, `/posts/${post._id}/poll/vote`, { method: "PUT", json: { optionId } });
  }
  await latency(200);
  if (isPollClosed(post)) throw new Error("This poll has closed.");
  const book = update<VoteBook>(KEY, seedPollVotes, (b) => ({
    ...b,
    [post._id]: { ...(b[post._id] ?? {}), [user.uid]: optionId },
  }));
  return summarise(post, book[post._id] ?? {}, user.uid);
}

/** live: DELETE /posts/:id/poll/vote → PollResults. Removes the viewer's vote while open. */
export async function unvotePoll(user: User, post: Post): Promise<PollResults> {
  if (isLive("polls")) {
    return apiFetch<PollResults>(user, `/posts/${post._id}/poll/vote`, { method: "DELETE" });
  }
  await latency(200);
  if (isPollClosed(post)) throw new Error("This poll has closed.");
  const book = update<VoteBook>(KEY, seedPollVotes, (b) => {
    const votes = { ...(b[post._id] ?? {}) };
    delete votes[user.uid];
    return { ...b, [post._id]: votes };
  });
  return summarise(post, book[post._id] ?? {}, user.uid);
}
