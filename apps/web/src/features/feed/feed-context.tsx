"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import * as postsApi from "@/lib/api/posts";
import { errorMessage } from "@/lib/api/client";
import type { CreatePostInput, Post, ReactionType } from "@/lib/api/types";

const PAGE_SIZE = 10;

interface FeedContextValue {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  /** Set when the first page fails — distinct from an empty neighbourhood. */
  error: string | null;
  hasMore: boolean;
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

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // The one call site that supplies a neighborhoodId to the feed — always
  // the signed-in user's own profile, never a prop or query param, so a
  // Yaba resident can never end up fetching Ikeja's feed or vice versa.
  const neighborhoodId = profile?.neighborhoodId;

  const refetch = useCallback(async () => {
    if (!user || !neighborhoodId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await postsApi.listFeed(user, neighborhoodId, { limit: PAGE_SIZE, skip: 0 });
      setPosts(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch neighbourhood feed:", err);
      setError(errorMessage(err, "Couldn't load your neighbourhood feed."));
    } finally {
      setLoading(false);
    }
  }, [user, neighborhoodId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = async () => {
    if (!user || !neighborhoodId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await postsApi.listFeed(user, neighborhoodId, {
        limit: PAGE_SIZE,
        skip: posts.length,
      });
      setPosts((prev) => mergePage(prev, page));
      setHasMore(page.length === PAGE_SIZE);
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
    upsertPost({ ...post, likes, myReaction: type });
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
        loadingMore,
        error,
        hasMore,
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
