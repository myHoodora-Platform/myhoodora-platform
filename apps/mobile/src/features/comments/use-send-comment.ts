import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { addComment, feedKeys } from "@/features/feed/feed-api";
import { updatePostEverywhere } from "@/features/feed/use-reaction";
import { insertComment } from "./comment-cache";
import { newClientId } from "./comment-drafts";
import { signal } from "@/features/feedback/engagement";

export interface PendingComment {
  clientId: string;
  content: string;
  parentId?: string;
  /** The thread it will appear in (where the sheet shows it while sending). */
  rootId?: string;
  replyToName?: string;
  status: "sending" | "failed";
  error?: string;
}

/**
 * Sending comments from the sheet. Each one shows at once as "Sending…", then takes its place in the
 * thread, or stays as "Couldn't send · Tap to retry". It never makes two: the same words to the same
 * place can't be sent again while on their way, and a retry reuses the comment's clientId, so the API
 * returns the first if it did arrive.
 */
export function useSendComment(post: Pick<ApiPost, "_id">) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const [pending, setPending] = useState<PendingComment[]>([]);
  // Mirrors `pending` for synchronous checks: two taps in one frame both see the first.
  const inFlight = useRef(new Map<string, PendingComment>());

  const deliver = useCallback(
    async (p: PendingComment) => {
      inFlight.current.set(p.clientId, p);
      setPending((rows) => [...rows.filter((r) => r.clientId !== p.clientId), p]);
      try {
        const saved = await addComment(user, post._id, p.content, { parentId: p.parentId, clientId: p.clientId });
        insertComment(client, post._id, saved);
        signal(user, "comment_created", post._id);
        updatePostEverywhere(client, post._id, (x) => ({ ...x, commentCount: (x.commentCount ?? 0) + 1 }));
        // The old flat list (the post's own page) refreshes in the background.
        void client.invalidateQueries({ queryKey: feedKeys.comments(post._id), exact: true });
        setPending((rows) => rows.filter((r) => r.clientId !== p.clientId));
      } catch (err) {
        setPending((rows) => rows.map((r) => (r.clientId === p.clientId ? { ...r, status: "failed", error: errorMessage(err) } : r)));
      } finally {
        inFlight.current.delete(p.clientId);
      }
    },
    [client, post._id, user],
  );

  /** False when nothing was sent (empty, or the same words already on their way). */
  const send = useCallback(
    (content: string, replyTo?: { commentId: string; rootId: string; name: string }) => {
      const text = content.trim();
      if (!text) return false;
      const twin = [...inFlight.current.values()].some((p) => p.content === text && p.parentId === replyTo?.commentId);
      if (twin) return false;
      void deliver({ clientId: newClientId(), content: text, parentId: replyTo?.commentId, rootId: replyTo?.rootId, replyToName: replyTo?.name, status: "sending" });
      return true;
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const p = pending.find((r) => r.clientId === clientId);
      if (p && p.status === "failed" && !inFlight.current.has(clientId)) void deliver({ ...p, status: "sending", error: undefined });
    },
    [deliver, pending],
  );

  const discard = useCallback((clientId: string) => setPending((rows) => rows.filter((r) => r.clientId !== clientId || r.status !== "failed")), []);

  return { pending, send, retry, discard };
}
