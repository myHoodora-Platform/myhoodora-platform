import type { User } from "@firebase/auth";
import { ApiError } from "@myhoodora/api-contract/errors";
import type { AdEventInput, FeedAd, FeedPage } from "@myhoodora/api-contract/ads";
import type { AlertCategory, ApiPost, Comment, CommentSort, PostCategory, ReactionType, ReportReason } from "@myhoodora/api-contract/types";
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
  /** Under `comments`, so invalidating a post's comments refreshes these too. */
  thread: (id: string, sort: CommentSort) => ["post", id, "comments", "thread", sort] as const,
  replies: (id: string, parentId: string) => ["post", id, "comments", "replies", parentId] as const,
  hoodName: (id: string) => ["hood", id] as const,
  /** Under `all`, so a post changed anywhere (a reaction, an edit) is changed here too. */
  saved: ["feed", "saved"] as const,
};

/** `GET /posts/neighborhood/:id?limit&before&category`. `before` is the last post's createdAt (cursor paging). */
export function listFeed(user: User, hoodId: string, before?: string, category?: PostCategory): Promise<ApiPost[]> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE) });
  if (before) params.set("before", before);
  if (category) params.set("category", category);
  return apiFetch<ApiPost[]>(user, `/posts/neighborhood/${hoodId}?${params}`);
}

/** A sponsored item in a feed page, where it was placed. Its `_id` never matches a post's. */
export interface AdEntry {
  kind: "ad";
  _id: string;
  slotId: string;
  ad: FeedAd;
}
export type FeedEntry = ApiPost | AdEntry;
export const isAd = (e: FeedEntry): e is AdEntry => (e as AdEntry).kind === "ad";

/** A page of the neighbourhood feed: posts with ads among them, and where the next page starts. */
export interface HoodPage {
  entries: FeedEntry[];
  next: string | null;
}
/** Any page kept under `feedKeys.all`: a hood feed page, or a plain list of posts (saved, search). */
export type AnyFeedPage = HoodPage | FeedEntry[];

export const pageEntries = (page: AnyFeedPage): FeedEntry[] => (Array.isArray(page) ? page : page.entries);
export const pagePosts = (page: AnyFeedPage): ApiPost[] => pageEntries(page).filter((e): e is ApiPost => !isAd(e));

/** Changes every feed page held (any filter, saved): `change` gets each page's entries. */
export function updateFeedEntries(client: QueryClient, change: (entries: FeedEntry[]) => FeedEntry[]) {
  client.setQueriesData<InfiniteData<AnyFeedPage>>({ queryKey: feedKeys.all }, (data) =>
    data?.pages ? { ...data, pages: data.pages.map((page) => (Array.isArray(page) ? change(page) : { ...page, entries: change(page.entries) })) } : data,
  );
}

/** Every post the feed caches hold right now. */
export function cachedFeedPosts(client: QueryClient): ApiPost[] {
  return client.getQueriesData<InfiniteData<AnyFeedPage>>({ queryKey: feedKeys.all }).flatMap(([, data]) => data?.pages?.flatMap(pagePosts) ?? []);
}

/**
 * `GET /feed/hood/:id`: the feed with sponsored items placed by the API (contract §32). `session`
 * is this feed session's id. Against an API that doesn't have the route yet, the plain feed (no ads).
 */
export async function listHoodPage(user: User, hoodId: string, opts: { cursor?: string; category?: PostCategory; session: string }): Promise<HoodPage> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE), session: opts.session });
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.category) params.set("category", opts.category);
  try {
    const page = await apiFetch<FeedPage>(user, `/feed/hood/${hoodId}?${params}`);
    return {
      entries: page.items.map((i) => (i.type === "post" ? i.data : { kind: "ad", _id: `ad:${i.slotId}`, slotId: i.slotId, ad: i.data })),
      next: page.nextCursor,
    };
  } catch (err) {
    // An older API: the route itself is missing ("Cannot GET"), not the neighbourhood.
    if (!(err instanceof ApiError && err.status === 404 && /^Cannot GET/.test(err.message))) throw err;
    const posts = await listFeed(user, hoodId, opts.cursor, opts.category);
    return { entries: posts, next: nextCursor(posts) ?? null };
  }
}

/** Impressions and clicks, a batch at a time (each counts once per ad, session and kind). */
export function sendAdEvents(user: User, events: AdEventInput[]): Promise<{ recorded: number }> {
  return apiFetch(user, "/ads/events", { method: "POST", json: { events } });
}

export function hideAd(user: User, adId: string, sessionId?: string): Promise<{ hidden: true }> {
  return apiFetch(user, `/ads/${adId}/hide`, { method: "POST", json: { sessionId } });
}

export function reportAd(user: User, adId: string, reason: ReportReason, sessionId?: string): Promise<{ reported: true }> {
  return apiFetch(user, `/ads/${adId}/report`, { method: "POST", json: { reason, sessionId } });
}

/** The cursor for the next page, or undefined when this page was the last. */
export function nextCursor(page: ApiPost[]): string | undefined {
  return page.length < FEED_PAGE ? undefined : page[page.length - 1]?.createdAt;
}

export function getPost(user: User, id: string): Promise<ApiPost> {
  return apiFetch<ApiPost>(user, `/posts/${id}`);
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
  type?: "event";
  eventDate?: string;
  eventLocation?: string;
  poll?: { options: { id: string; text: string }[]; closesAt: string };
  /** Uploaded photo URLs (POST /media), up to 10. */
  mediaUrls?: string[];
  /** One per draft: if the request is retried after a lost response, the API returns the same post. */
  clientId: string;
}

/** `POST /posts` with the first-class fields (contract §1). */
export function createPost(user: User, hoodId: string, post: NewPost): Promise<ApiPost> {
  return apiFetch<ApiPost>(user, "/posts", { method: "POST", json: { neighborhoodId: hoodId, ...post } });
}

export function addComment(user: User, postId: string, content: string, extra: { parentId?: string; clientId?: string } = {}): Promise<Comment> {
  return apiFetch<Comment>(user, `/posts/${postId}/comments`, { method: "POST", json: { content, ...extra } });
}

/** Comments per page in the sheet. */
export const THREAD_PAGE = 20;

/** The threaded view (contract §2): top-level comments in `sort` order, or with `parentId` that comment's replies. Offset paging. */
export function listThread(user: User, postId: string, opts: { sort?: CommentSort; parentId?: string; offset?: number }): Promise<Comment[]> {
  const params = new URLSearchParams({ thread: opts.parentId ?? "root", limit: String(THREAD_PAGE), offset: String(opts.offset ?? 0) });
  if (!opts.parentId && opts.sort) params.set("sort", opts.sort);
  return apiFetch<Comment[]>(user, `/posts/${postId}/comments?${params}`);
}

/** Next offset, or undefined after a short page. */
export function nextOffset(page: Comment[], pages: Comment[][]): number | undefined {
  return page.length < THREAD_PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0);
}

export function setCommentLiked(user: User, commentId: string, liked: boolean): Promise<{ likeCount: number; liked: boolean }> {
  return apiFetch(user, `/comments/${commentId}/like`, { method: liked ? "PUT" : "DELETE" });
}

/** Private: never tells anyone who reported (contract §9). */
export function report(user: User, targetType: "post" | "comment" | "listing" | "message" | "user", targetId: string, reason: ReportReason): Promise<void> {
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
  const found = cachedFeedPosts(client).find((p) => p._id === id);
  if (found) return found;
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

/** Save for later, or unsave (contract §1, the post menu). */
export function setSaved(user: User, postId: string, saved: boolean): Promise<{ saved: boolean }> {
  return apiFetch(user, `/posts/${postId}/save`, { method: saved ? "PUT" : "DELETE" });
}

/** `GET /posts/saved`: newest saved first; `before` is the last one's `savedAt`. */
export function listSaved(user: User, before?: string): Promise<(ApiPost & { savedAt: string })[]> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE) });
  if (before) params.set("before", before);
  return apiFetch(user, `/posts/saved?${params}`);
}

/** Turn a post's notifications on (follow) or off (mute). */
export function setFollowing(user: User, postId: string, on: boolean): Promise<{ following: boolean }> {
  return apiFetch(user, `/posts/${postId}/follow`, { method: "PUT", json: { on } });
}

/** Counts a share (once per neighbour), after the share sheet was used. */
export function recordShare(user: User, postId: string): Promise<{ shareCount: number }> {
  return apiFetch(user, `/posts/${postId}/share`, { method: "POST" });
}

/** The author changes the text; returns the post. */
export function editPost(user: User, postId: string, message: string): Promise<ApiPost> {
  return apiFetch(user, `/posts/${postId}`, { method: "PATCH", json: { message } });
}
