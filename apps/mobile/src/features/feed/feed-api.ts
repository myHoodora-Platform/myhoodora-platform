import type { User } from "@firebase/auth";
import type { AlertCategory, ApiPost, Comment, PostCategory, ReactionType, ReportReason } from "@myhoodora/api-contract/types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/core/api/client";

/** Page size the web uses, kept small for Nigerian mobile data (contract §0). */
export const FEED_PAGE = 10;

/**
 * The feed's filters: the web's chips (apps/web/src/features/feed/categories.ts), asked of the API by
 * category (contract §1) so each one pages properly instead of filtering what's already loaded.
 */
export const FEED_FILTERS = [
  { id: "all", label: "All", category: undefined },
  { id: "alerts", label: "Alerts", category: "alert" },
  { id: "recommendations", label: "Recommendations", category: "recommendation" },
  { id: "for-sale", label: "For sale", category: "for_sale" },
  { id: "events", label: "Events", category: "event" },
  { id: "lost-found", label: "Lost & found", category: "lost_found" },
] as const satisfies readonly { id: string; label: string; category: PostCategory | undefined }[];

export type FeedFilter = (typeof FEED_FILTERS)[number]["id"];

export const feedKeys = {
  all: ["feed"] as const,
  hood: (hoodId: string, filter: FeedFilter = "all") => ["feed", hoodId, filter] as const,
  post: (id: string) => ["post", id] as const,
  comments: (id: string) => ["post", id, "comments"] as const,
  hoodName: (id: string) => ["hood", id] as const,
};

/** `GET /posts/neighborhood/:id?limit&before&category`. `before` is the last post's createdAt (cursor paging). */
export function listFeed(user: User, hoodId: string, before?: string, category?: PostCategory): Promise<ApiPost[]> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE) });
  if (before) params.set("before", before);
  if (category) params.set("category", category);
  return apiFetch<ApiPost[]>(user, `/posts/neighborhood/${hoodId}?${params}`);
}

/** The cursor for the next page, or undefined when this page was the last. */
export function nextCursor(page: ApiPost[]): string | undefined {
  return page.length < FEED_PAGE ? undefined : page[page.length - 1]?.createdAt;
}

export function getPost(user: User, id: string): Promise<ApiPost> {
  return apiFetch<ApiPost>(user, `/posts/${id}`);
}

export function listComments(user: User, postId: string): Promise<Comment[]> {
  return apiFetch<Comment[]>(user, `/posts/${postId}/comments`);
}

export function getHood(user: User, id: string): Promise<{ _id: string; name: string; city?: string }> {
  return apiFetch(user, `/neighborhoods/${id}`);
}

/** Set your reaction, or take it back with `null` (contract §1: one reaction per neighbour). Returns the post. */
export function setReaction(user: User, postId: string, type: ReactionType | null): Promise<ApiPost> {
  return type
    ? apiFetch<ApiPost>(user, `/posts/${postId}/reaction`, { method: "PUT", json: { type } })
    : apiFetch<ApiPost>(user, `/posts/${postId}/reaction`, { method: "DELETE" });
}

/** A new link to confirm the email address (the web's banner). */
export function resendVerificationEmail(user: User): Promise<void> {
  return apiFetch<void>(user, "/auth/email-verification/resend", { method: "POST" });
}

export interface NewPost {
  message: string;
  category: PostCategory;
  alertCategory?: AlertCategory;
  urgent?: boolean;
  thankedName?: string;
  /** Uploaded photo URLs (POST /media), up to 10. */
  mediaUrls?: string[];
  /** One per draft: if the request is retried after a lost response, the API returns the same post. */
  clientId: string;
}

/** `POST /posts` with the first-class fields (contract §1). */
export function createPost(user: User, hoodId: string, post: NewPost): Promise<ApiPost> {
  return apiFetch<ApiPost>(user, "/posts", { method: "POST", json: { neighborhoodId: hoodId, ...post } });
}

export function addComment(user: User, postId: string, content: string): Promise<Comment> {
  return apiFetch<Comment>(user, `/posts/${postId}/comments`, { method: "POST", json: { content } });
}

/** Private: never tells anyone who reported (contract §9). */
export function report(user: User, targetType: "post" | "comment" | "listing" | "message", targetId: string, reason: ReportReason): Promise<void> {
  return apiFetch<void>(user, "/reports", { method: "POST", json: { targetType, targetId, reason } });
}

/** The Kindness Reminder (contract §22): a nudge, never a block. Fails open. */
export function kindnessCheck(user: User, text: string): Promise<{ flagged: boolean; reasons: string[] }> {
  return apiFetch(user, "/moderation/check", { method: "POST", json: { text } });
}

/**
 * The post as the feed (any filter) or search already holds it, so opening it shows at once while the
 * fresh copy loads. Undefined when it isn't cached (opened from a push or a link).
 */
export function cachedPost(client: QueryClient, id: string): ApiPost | undefined {
  for (const [, data] of client.getQueriesData<InfiniteData<ApiPost[]>>({ queryKey: feedKeys.all })) {
    const found = data?.pages?.flat().find((p) => p._id === id);
    if (found) return found;
  }
  for (const [, data] of client.getQueriesData<{ posts?: ApiPost[] }>({ queryKey: ["search"] })) {
    const found = data?.posts?.find((p) => p._id === id);
    if (found) return found;
  }
  return undefined;
}

/** Your own comment (or, for leads and staff, anyone's in the Hood: the API decides). */
export function deleteComment(user: User, commentId: string): Promise<void> {
  return apiFetch<void>(user, `/comments/${commentId}`, { method: "DELETE" });
}

/** Your own post (the API checks it's yours; anyone else gets 403/404). */
export function deletePost(user: User, postId: string): Promise<void> {
  return apiFetch<void>(user, `/posts/${postId}`, { method: "DELETE" });
}
