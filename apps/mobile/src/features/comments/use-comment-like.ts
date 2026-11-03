import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Comment } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { setCommentLiked } from "@/features/feed/feed-api";
import { useToast } from "@/shared/ui/toast";
import { updateComment } from "./comment-cache";

/** Like or unlike a comment at once; put back with a message if the API refuses. Taps on a comment already on its way are ignored. */
export function useCommentLike(postId: string) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const busy = useRef(new Set<string>());
  return useCallback(
    async (comment: Comment) => {
      if (busy.current.has(comment._id)) return;
      busy.current.add(comment._id);
      const liked = !comment.liked;
      const before = { liked: !!comment.liked, likeCount: comment.likeCount ?? 0 };
      updateComment(client, postId, comment._id, (c) => ({ ...c, liked, likeCount: Math.max(0, (c.likeCount ?? 0) + (liked ? 1 : -1)) }));
      try {
        const now = await setCommentLiked(user, comment._id, liked);
        updateComment(client, postId, comment._id, (c) => ({ ...c, ...now }));
      } catch (err) {
        updateComment(client, postId, comment._id, (c) => ({ ...c, ...before }));
        toast(errorMessage(err), "error");
      } finally {
        busy.current.delete(comment._id);
      }
    },
    [client, postId, toast, user],
  );
}
