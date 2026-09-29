import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { isRemoved } from "./mock/moderation-state";
import { latency, load, mockId, save } from "./mock/store";
import { seedComments } from "./mock/seed";
import type { Comment } from "./types";

const KEY = "comments";
const all = () => load<Comment[]>(KEY, seedComments);

/** Sync count for feed cards. planned: `commentCount` on the post document. */
export function commentCount(postId: string): number {
  if (typeof window === "undefined") return 0;
  return all().filter((c) => c.postId === postId && !isRemoved("comment", c._id)).length;
}

/** planned: GET /posts/:id/comments — oldest first. */
export async function listComments(user: User, postId: string): Promise<Comment[]> {
  if (isLive("comments")) return apiFetch<Comment[]>(user, `/posts/${postId}/comments`);
  await latency();
  return all()
    .filter((c) => c.postId === postId && !isRemoved("comment", c._id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** planned: POST /posts/:id/comments { content } */
export async function addComment(user: User, postId: string, content: string): Promise<Comment> {
  if (isLive("comments")) {
    return apiFetch<Comment>(user, `/posts/${postId}/comments`, { method: "POST", json: { content } });
  }
  await latency();
  const comment: Comment = {
    _id: mockId("mc"),
    postId,
    authorUid: user.uid,
    content,
    createdAt: new Date().toISOString(),
    likes: [],
  };
  save(KEY, [...all(), comment]);
  return comment;
}

/** planned: DELETE /comments/:id (author only). */
export async function deleteComment(user: User, commentId: string): Promise<void> {
  if (isLive("comments")) {
    await apiFetch<void>(user, `/comments/${commentId}`, { method: "DELETE" });
    return;
  }
  await latency();
  save(KEY, all().filter((c) => c._id !== commentId));
}
