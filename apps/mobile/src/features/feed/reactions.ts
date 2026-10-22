import type { ApiPost } from "@myhoodora/api-contract/types";

/** The post as it will be once liked (or un-liked): shown at once, before the API answers. */
export function withLike(post: ApiPost, liked: boolean): ApiPost {
  const had = post.myReaction ?? null;
  if (liked === !!had) return post;
  const counts = { ...post.reactionCounts };
  if (had) counts[had] = Math.max(0, (counts[had] ?? 1) - 1);
  if (liked) counts.like = (counts.like ?? 0) + 1;
  return { ...post, myReaction: liked ? "like" : null, reactionCounts: counts, reactionTotal: Math.max(0, (post.reactionTotal ?? 0) + (liked ? 1 : -1)) };
}
