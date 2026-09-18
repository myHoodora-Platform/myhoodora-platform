"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNeighborhoodFeed,
  createPost as createPostApi,
  toggleLike as toggleLikeApi,
  deletePost as deletePostApi,
  type Post,
  type PostType,
} from "@/lib/firebase/posts";

const PAGE_SIZE = 10;

interface CreatePostInput {
  content: string;
  type: PostType;
  mediaUrl?: string;
}

interface FeedContextType {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  createPost: (input: CreatePostInput) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // The one call site that supplies a neighborhoodId to the feed — always
  // the signed-in user's own profile, never a prop or query param, so a
  // Yaba resident can never end up fetching Ikeja's feed or vice versa.
  const neighborhoodId = profile?.neighborhoodId;

  useEffect(() => {
    if (!user || !neighborhoodId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchNeighborhoodFeed(user, neighborhoodId, { limit: PAGE_SIZE, skip: 0 })
      .then((page) => {
        setPosts(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((err) => console.error("Failed to fetch neighborhood feed:", err))
      .finally(() => setLoading(false));
  }, [user, neighborhoodId]);

  const loadMore = async () => {
    if (!user || !neighborhoodId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchNeighborhoodFeed(user, neighborhoodId, {
        limit: PAGE_SIZE,
        skip: posts.length,
      });
      setPosts((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const createPost = async ({ content, type, mediaUrl }: CreatePostInput) => {
    if (!user || !neighborhoodId) throw new Error("Not authenticated.");
    const created = await createPostApi(user, {
      neighborhoodId,
      content,
      type,
      mediaUrls: mediaUrl ? [mediaUrl] : undefined,
    });
    setPosts((prev) => [created, ...prev]);
  };

  const toggleLike = async (postId: string) => {
    if (!user) throw new Error("Not authenticated.");
    const previous = posts;
    // Optimistic flip so the tap feels instant; reconciled with the real
    // doc below, rolled back if the request fails.
    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
              ...p,
              likes: p.likes.includes(user.uid)
                ? p.likes.filter((uid) => uid !== user.uid)
                : [...p.likes, user.uid],
            }
          : p,
      ),
    );
    try {
      const updated = await toggleLikeApi(user, postId);
      setPosts((prev) => prev.map((p) => (p._id === postId ? updated : p)));
    } catch (err) {
      console.error("Failed to toggle like:", err);
      setPosts(previous);
      throw err;
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) throw new Error("Not authenticated.");
    const previous = posts;
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    try {
      await deletePostApi(user, postId);
    } catch (err) {
      console.error("Failed to delete post:", err);
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
        hasMore,
        loadMore,
        createPost,
        toggleLike,
        deletePost,
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
