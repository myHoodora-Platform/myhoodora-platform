import type { ApiPost, ReactionType } from "@myhoodora/api-contract/types";

/** The web's set and order (apps/web/src/features/feed/categories.ts): Nextdoor's, deliberately no "Angry". */
export const REACTIONS: { id: ReactionType; emoji: string; label: string }[] = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "helpful", emoji: "🙌", label: "Helpful" },
  { id: "agree", emoji: "✅", label: "Agree" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
];

export function reactionDef(id: ReactionType) {
  return REACTIONS.find((r) => r.id === id) ?? REACTIONS[0]!;
}

/** The post as it will be with your reaction set (or taken back, `null`): shown at once, before the API answers. */
export function withReaction(post: ApiPost, type: ReactionType | null): ApiPost {
  const had = post.myReaction ?? null;
  if (had === type) return post;
  const counts = { ...post.reactionCounts };
  if (had) counts[had] = Math.max(0, (counts[had] ?? 1) - 1);
  if (type) counts[type] = (counts[type] ?? 0) + 1;
  const total = Math.max(0, (post.reactionTotal ?? 0) + (type ? 1 : 0) - (had ? 1 : 0));
  return { ...post, myReaction: type, reactionCounts: counts, reactionTotal: total };
}

/** The most used reactions on a post, most first (the faces beside its count). */
export function topReactions(counts: ApiPost["reactionCounts"], n = 3): ReactionType[] {
  return REACTIONS.map((r) => ({ id: r.id, c: counts?.[r.id] ?? 0 }))
    .filter((r) => r.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, n)
    .map((r) => r.id);
}
