import type { User } from "firebase/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export type PostType = "text" | "image" | "event" | "alert";

export interface Post {
  _id: string;
  authorUid: string;
  neighborhoodId: string;
  type: PostType;
  content: string;
  mediaUrls: string[];
  likes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostPayload {
  neighborhoodId: string;
  content: string;
  type?: PostType;
  mediaUrls?: string[];
}

export async function fetchNeighborhoodFeed(
  user: User,
  neighborhoodId: string,
  { limit = 20, skip = 0 }: { limit?: number; skip?: number } = {},
): Promise<Post[]> {
  const token = await user.getIdToken();
  const params = new URLSearchParams({
    limit: String(limit),
    skip: String(skip),
  });
  const response = await fetch(
    `${API_BASE_URL}/posts/neighborhood/${neighborhoodId}?${params.toString()}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch neighborhood feed: ${response.status}`);
  }

  return response.json();
}

export async function createPost(
  user: User,
  payload: CreatePostPayload,
): Promise<Post> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to create post.");
  }

  return response.json();
}

export async function toggleLike(user: User, postId: string): Promise<Post> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to toggle like: ${response.status}`);
  }

  return response.json();
}

export async function deletePost(user: User, postId: string): Promise<void> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete post: ${response.status}`);
  }
}
