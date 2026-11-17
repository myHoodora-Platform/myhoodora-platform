/**
 * Who may see and take part in a post, from its audience (Nextdoor's model, docs/product/hood-
 * activation-plan.md §8):
 *
 * - "neighbourhood" (Your Hood, the default): the Hood's neighbours (and people staff let follow it).
 * - "nearby": also verified neighbours of the Hoods next to it (HoodsService.nearbyHoodIds).
 * - "anyone": anyone can read it, even without an account; verified neighbours anywhere can react and
 *   reply. Hood Team posts, listings and events default to it.
 *
 * Outside the audience you get a teaser: which Hood, the topic, the counts. Never the text, photos
 * or names. Safety alerts are always the Hood's own. Pure function: callers load the nearby Hoods.
 */
import type { PostVisibility } from "./post-meta";

export type ReadMode = "full" | "teaser";

export interface PostAccess {
  read: ReadMode;
  /** React, reply, save, follow: the post's own Hood, or a verified neighbour in its audience. */
  takePart: boolean;
}

export interface AccessViewer {
  /** Verified home Hood (null before joining one). */
  hoodId: string | null;
  /** Home plus followed Hoods. */
  readableHoodIds: readonly string[];
  staff: boolean;
}

export interface AccessPost {
  neighborhoodId: string;
  visibility?: PostVisibility | null;
  category: string;
}

/** Audiences from narrowest to widest: an edit may move left, never right. */
export const AUDIENCE_ORDER: readonly PostVisibility[] = ["neighbourhood", "nearby", "anyone"];

export function isNarrowing(from: PostVisibility, to: PostVisibility): boolean {
  return AUDIENCE_ORDER.indexOf(to) <= AUDIENCE_ORDER.indexOf(from);
}

/** `viewer` null = signed out. `nearbyOfPostHood` = the Hoods next to the post's Hood. */
export function postAccess(viewer: AccessViewer | null, post: AccessPost, nearbyOfPostHood: readonly string[] = []): PostAccess {
  // Their own Hood, and a Hood they follow (work, family; contract §31): read, react and reply. New posts
  // still only go to their own Hood (PostsService.create).
  if (viewer && (viewer.staff || viewer.readableHoodIds.includes(post.neighborhoodId))) return { read: "full", takePart: Boolean(viewer.staff || viewer.hoodId) };
  const visibility = post.visibility ?? "neighbourhood";
  const inAudience =
    post.category !== "alert" && (visibility === "anyone" || (visibility === "nearby" && Boolean(viewer?.hoodId) && nearbyOfPostHood.includes(viewer!.hoodId!)));
  const takePart = inAudience && Boolean(viewer?.hoodId);
  if (inAudience) return { read: "full", takePart };
  return { read: "teaser", takePart: false };
}

/** "Adaeze Okafor" → "A. O."; "Tunde" → "T."; nothing letter-like → "N." (neighbour). */
export function initials(name: string | undefined | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => /\p{L}|\p{N}/u.exec(p)?.[0]?.toUpperCase()).filter(Boolean);
  return letters.length ? letters.map((l) => `${l}.`).join(" ") : "N.";
}
