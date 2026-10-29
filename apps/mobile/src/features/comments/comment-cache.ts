import type { Comment } from "@myhoodora/api-contract/types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { feedKeys } from "@/features/feed/feed-api";

type Pages = InfiniteData<Comment[], number>;

function isPages(data: unknown): data is Pages {
  return !!data && typeof data === "object" && Array.isArray((data as Pages).pages);
}

/** Every cached copy of a comment (the sheet's sorts, its replies, the old flat list), changed the same way. */
export function updateComment(client: QueryClient, postId: string, id: string, change: (c: Comment) => Comment) {
  client.setQueriesData<Pages | Comment[]>({ queryKey: feedKeys.comments(postId) }, (data) => {
    if (isPages(data)) return { ...data, pages: data.pages.map((page) => page.map((c) => (c._id === id ? change(c) : c))) };
    if (Array.isArray(data)) return data.map((c) => (c._id === id ? change(c) : c));
    return data;
  });
}

/** Your new comment where you'll see it: top of every sort, or the end of its thread's replies (whose count goes up). */
export function insertComment(client: QueryClient, postId: string, comment: Comment) {
  if (comment.parentId) {
    client.setQueryData<Pages>(feedKeys.replies(postId, comment.parentId), (data) =>
      data && !data.pages.flat().some((c) => c._id === comment._id) ? { ...data, pages: [...data.pages.slice(0, -1), [...(data.pages.at(-1) ?? []), comment]] } : data,
    );
    updateComment(client, postId, comment.parentId, (c) => ({ ...c, replyCount: (c.replyCount ?? 0) + 1 }));
    return;
  }
  client.setQueriesData<Pages>({ queryKey: [...feedKeys.comments(postId), "thread"] }, (data) =>
    isPages(data) && !data.pages.flat().some((c) => c._id === comment._id) ? { ...data, pages: [[comment, ...(data.pages[0] ?? [])], ...data.pages.slice(1)] } : data,
  );
}
