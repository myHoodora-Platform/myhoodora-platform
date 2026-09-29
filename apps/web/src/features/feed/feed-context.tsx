"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import * as postsApi from "@/lib/api/posts";
import { errorKind, errorMessage, type ApiErrorKind } from "@/lib/api/client";
import type { CreatePostInput, Post, ReactionType } from "@/lib/api/types";
import { readFeedCache, writeFeedCache } from "./feed-cache";

const PAGE_SIZE = 10;
/** Returning to the tab after this long quietly refreshes the feed. */
const REFRESH_ON_FOCUS_AFTER_MS = 2 * 60 * 1000;

export interface FeedProblem {
  message: string;
  kind: ApiErrorKind | null;
}

interface FeedContextValue {
  posts: Post[];
  /** First load with nothing to show yet. */
  loading: boolean;
  /** Background refresh while (cached) posts are on screen. */
  refreshing: boolean;
  loadingMore: boolean;
  /** First load failed and there's nothing cached — show a full error state. */
  error: FeedProblem | null;
  /** A refresh failed but older posts are still shown — show an inline notice. */
  stale: (FeedProblem & { since: string | null }) | null;
  loadMoreError: FeedProblem | null;
  hasMore: boolean;
  lastUpdated: string | null;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  createPost: (input: CreatePostInput) => Promise<Post>;
  /** Optimistic react/unreact; resolves with the server's version of the post. */
  react: (post: Post, type: ReactionType | null) => Promise<Post>;
  deletePost: (postId: string) => Promise<void>;
  /** Replace one post in the list (e.g. after the post page refreshes it). */
  upsertPost: (post: Post) => void;
}

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

/** Append a page without duplicating posts the skip offset re-served. */
function mergePage(existing: Post[], page: Post[]): Post[] {
  const seen = new Set(existing.map((p) => p._id));
  return [...existing, ...page.filter((p) => !seen.has(p._id))];
}

function problemFrom(err: unknown, fallback: string): FeedProblem {
  return { message: errorMessage(err, fallback), kind: errorKind(err) };
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<FeedProblem | null>(null);
  const [stale, setStale] = useState<FeedContextValue["stale"]>(null);
  const [loadMoreError, setLoadMoreError] = useState<FeedProblem | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const postsRef = useRef<Post[]>([]);
  postsRef.current = posts;

  // The one call site that supplies a neighborhoodId to the feed — always
  // the signed-in user's own profile, never a prop or query param, so a
  // Yaba resident can never end up fetching Ikeja's feed or vice versa.
  const neighborhoodId = profile?.neighborhoodId;

  const refetch = useCallback(async () => {
    if (!user || !neighborhoodId) {
      setLoading(false);
      return;
    }
    // Show the last good feed straight away, then refresh behind it.
    let shown = postsRef.current;
    let cachedAt: string | null = lastUpdated;
    if (shown.length === 0) {
      const cache = readFeedCache(user.uid, neighborhoodId);
      if (cache) {
        shown = cache.posts;
        cachedAt = cache.savedAt;
        setPosts(cache.posts);
        setLastUpdated(cache.savedAt);
      }
    }
    setLoading(shown.length === 0);
    setRefreshing(shown.length > 0);
    setError(null);
    try {
      const page = await postsApi.listFeed(user, neighborhoodId, { limit: PAGE_SIZE, skip: 0 });
      setPosts(page);
      setHasMore(page.length === PAGE_SIZE);
      setStale(null);
      setLoadMoreError(null);
      const now = new Date().toISOString();
      setLastUpdated(now);
      writeFeedCache(user.uid, neighborhoodId, page);
    } catch (err) {
      console.error("Failed to fetch neighbourhood feed:", err);
      const problem = problemFrom(err, "Couldn't load your neighbourhood feed.");
      if (shown.length > 0) setStale({ ...problem, since: cachedAt });
      else setError(problem);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, neighborhoodId, lastUpdated]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const lastUpdatedRef = useRef(lastUpdated);
  lastUpdatedRef.current = lastUpdated;

  // Initial load (and when the user/neighbourhood changes).
  useEffect(() => {
    postsRef.current = [];
    setPosts([]);
    setLastUpdated(null);
    void refetchRef.current();
  }, [user, neighborhoodId]);

  // Recover automatically when the connection comes back, and refresh when
  // returning to the tab after a while (like most social apps).
  useEffect(() => {
    const onOnline = () => void refetchRef.current();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const age = lastUpdatedRef.current ? Date.now() - new Date(lastUpdatedRef.current).getTime() : Infinity;
      if (age > REFRESH_ON_FOCUS_AFTER_MS) void refetchRef.current();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const loadMore = async () => {
    if (!user || !neighborhoodId || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await postsApi.listFeed(user, neighborhoodId, {
        limit: PAGE_SIZE,
        skip: posts.length,
      });
      setPosts((prev) => mergePage(prev, page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setLoadMoreError(problemFrom(err, "Couldn't load more posts."));
    } finally {
      setLoadingMore(false);
    }
  };

  const createPost = async (input: CreatePostInput) => {
    if (!user || !neighborhoodId) throw new Error("Not signed in.");
    const created = await postsApi.createPost(user, neighborhoodId, input);
    setPosts((prev) => [created, ...prev]);
    return created;
  };

  const upsertPost = useCallback((post: Post) => {
    setPosts((prev) =>
      prev.some((p) => p._id === post._id)
        ? prev.map((p) => (p._id === post._id ? post : p))
        : prev,
    );
  }, []);

  const react = async (post: Post, type: ReactionType | null) => {
    if (!user) throw new Error("Not signed in.");
    const previous = posts;
    // Optimistic update so the tap feels instant; rolled back on failure.
    const wasReacted = post.myReaction !== null;
    const likes =
      type && !wasReacted
        ? [...post.likes, user.uid]
        : !type && wasReacted
          ? post.likes.filter((u) => u !== user.uid)
          : post.likes;
    const reactionTotal = post.reactionTotal + (type && !wasReacted ? 1 : !type && wasReacted ? -1 : 0);
    upsertPost({ ...post, likes, reactionTotal, myReaction: type });
    try {
      const updated = await postsApi.setReaction(user, post, type);
      upsertPost(updated);
      return updated;
    } catch (err) {
      setPosts(previous);
      throw err;
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) throw new Error("Not signed in.");
    const previous = posts;
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    try {
      await postsApi.deletePost(user, postId);
    } catch (err) {
      setPosts(previous);
      throw err;
    }
  };

  return (
    <FeedContext.Provider
      value={{
        posts,
        loading,
        refreshing,
        loadingMore,
        error,
        stale,
        loadMoreError,
        hasMore,
        lastUpdated,
        loadMore,
        refetch,
        createPost,
        react,
        deletePost,
        upsertPost,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (context === undefined) {
    throw new Error("useFeed must be used within a FeedProvider");
  }
  return context;
}
