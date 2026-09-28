import type { User } from "firebase/auth";
import { apiFetch, withRetry } from "./client";
import { isLive } from "./config";
import { alertResolutions } from "./alerts";
import { commentCount } from "./comments";
import { decodePostContent, encodePostContent, postTypeFor } from "./post-meta";
import { latency, load, mockId, save, update } from "./mock/store";
import { seedPosts } from "./mock/seed";
import type { ApiPost, CreatePostInput, Post, ReactionType } from "./types";

const POSTS_KEY = "posts";
const reactionsKey = (uid: string) => `reactions:${uid}`;

function myReactions(uid: string): Record<string, ReactionType> {
  return load<Record<string, ReactionType>>(reactionsKey(uid), () => ({}));
}

/** API document → what the UI renders. */
export function hydratePost(doc: ApiPost, viewerUid: string): Post {
  const { message, meta } = decodePostContent(doc.content, doc.type);
  const liked = doc.likes.includes(viewerUid);
  return {
    ...doc,
    message,
    meta,
    commentCount: commentCount(doc._id),
    myReaction: liked ? (myReactions(viewerUid)[doc._id] ?? "like") : null,
    resolvedAt: meta.category === "alert" ? (alertResolutions()[doc._id] ?? null) : null,
  };
}

function mockPosts(): ApiPost[] {
  return load(POSTS_KEY, seedPosts);
}

function sortNewestFirst(posts: ApiPost[]): ApiPost[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Feed ────────────────────────────────────────────────────────────────────

/** live: GET /posts/neighborhood/:id?limit&skip */
export async function listFeed(
  user: User,
  neighborhoodId: string,
  { limit = 10, skip = 0 }: { limit?: number; skip?: number } = {},
): Promise<Post[]> {
  let docs: ApiPost[];
  if (isLive("posts.list")) {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    // Reads retry once on transient failures (flaky mobile data is common).
    docs = await withRetry(() => apiFetch<ApiPost[]>(user, `/posts/neighborhood/${neighborhoodId}?${params}`));
  } else {
    await latency();
    docs = sortNewestFirst(mockPosts()).slice(skip, skip + limit);
  }
  return docs.map((d) => hydratePost(d, user.uid));
}

/**
 * planned: GET /posts/:id. Until it exists, pages through the live feed to
 * find the post (bounded), so /p/[id] works against today's backend.
 */
export async function getPost(
  user: User,
  neighborhoodId: string,
  postId: string,
): Promise<Post | null> {
  if (isLive("posts.get")) {
    const doc = await apiFetch<ApiPost>(user, `/posts/${postId}`);
    return hydratePost(doc, user.uid);
  }
  if (!isLive("posts.list")) {
    await latency();
    const doc = mockPosts().find((p) => p._id === postId);
    return doc ? hydratePost(doc, user.uid) : null;
  }
  const PAGE = 50;
  for (let page = 0; page < 6; page++) {
    const batch = await listFeed(user, neighborhoodId, { limit: PAGE, skip: page * PAGE });
    const found = batch.find((p) => p._id === postId);
    if (found) return found;
    if (batch.length < PAGE) break;
  }
  return null;
}

// ── Mutations ───────────────────────────────────────────────────────────────

/** live: POST /posts  { neighborhoodId, content, type, mediaUrls } */
export async function createPost(
  user: User,
  neighborhoodId: string,
  input: CreatePostInput,
): Promise<Post> {
  const payload = {
    neighborhoodId,
    content: encodePostContent(input.message, input.meta),
    type: postTypeFor(input.meta, Boolean(input.mediaUrl)),
    mediaUrls: input.mediaUrl ? [input.mediaUrl] : undefined,
  };
  if (isLive("posts.create")) {
    const doc = await apiFetch<ApiPost>(user, "/posts", { method: "POST", json: payload });
    return hydratePost(doc, user.uid);
  }
  await latency();
  const now = new Date().toISOString();
  const doc: ApiPost = {
    _id: mockId("mp"),
    authorUid: user.uid,
    neighborhoodId,
    type: payload.type,
    content: payload.content,
    mediaUrls: payload.mediaUrls ?? [],
    likes: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  save(POSTS_KEY, [doc, ...mockPosts()]);
  return hydratePost(doc, user.uid);
}

/** live: PATCH /posts/:id/like — toggles the viewer's like. */
async function toggleLike(user: User, postId: string): Promise<ApiPost> {
  if (isLive("posts.like")) {
    return apiFetch<ApiPost>(user, `/posts/${postId}/like`, { method: "PATCH" });
  }
  await latency(120);
  let updated: ApiPost | undefined;
  update(POSTS_KEY, seedPosts, (posts) =>
    posts.map((p) => {
      if (p._id !== postId) return p;
      const likes = p.likes.includes(user.uid)
        ? p.likes.filter((u) => u !== user.uid)
        : [...p.likes, user.uid];
      updated = { ...p, likes };
      return updated;
    }),
  );
  if (!updated) throw new Error("Post not found.");
  return updated;
}

/**
 * Set or clear the viewer's reaction.
 * planned: PUT /posts/:id/reaction { type } | DELETE /posts/:id/reaction.
 * Today the API only knows "liked or not", so the like is toggled for real
 * and the reaction *type* is remembered locally.
 */
export async function setReaction(
  user: User,
  post: Post,
  type: ReactionType | null,
): Promise<Post> {
  const hasReacted = post.myReaction !== null;
  const needsToggle = (type === null) === hasReacted;
  const doc = needsToggle ? await toggleLike(user, post._id) : post;
  update(reactionsKey(user.uid), () => ({}), (map: Record<string, ReactionType>) => {
    const next = { ...map };
    if (type) next[post._id] = type;
    else delete next[post._id];
    return next;
  });
  return hydratePost(doc, user.uid);
}

/** live: DELETE /posts/:id (author only — enforced by the API). */
export async function deletePost(user: User, postId: string): Promise<void> {
  if (isLive("posts.delete")) {
    await apiFetch<void>(user, `/posts/${postId}`, { method: "DELETE" });
    return;
  }
  await latency();
  save(POSTS_KEY, mockPosts().filter((p) => p._id !== postId));
}
