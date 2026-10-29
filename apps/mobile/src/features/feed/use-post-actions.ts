import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { shareLink } from "@/shared/utils/share";
import { feedKeys, recordShare, setFollowing, setSaved } from "./feed-api";
import { updatePostEverywhere } from "./use-reaction";

/**
 * The post menu's switches (save, notifications) and Share. Each shows at once wherever the post is
 * on screen, then tells the API; if the API refuses, it goes back and says why.
 */
export function usePostActions() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();

  const flip = async <K extends "saved" | "following">(post: ApiPost, key: K, value: boolean, send: () => Promise<unknown>, done: string) => {
    const before = post[key] ?? false;
    updatePostEverywhere(client, post._id, (p) => ({ ...p, [key]: value }));
    try {
      await send();
      toast(done);
      // The saved list gains or loses it.
      if (key === "saved") void client.invalidateQueries({ queryKey: feedKeys.saved });
    } catch (err) {
      updatePostEverywhere(client, post._id, (p) => ({ ...p, [key]: before }));
      toast(errorMessage(err), "error");
    }
  };

  return {
    save: (post: ApiPost, saved: boolean) => flip(post, "saved", saved, () => setSaved(user, post._id, saved), saved ? "Saved. Find it in Saved posts on your profile." : "Removed from your saved posts."),
    follow: (post: ApiPost, on: boolean) =>
      flip(post, "following", on, () => setFollowing(user, post._id, on), on ? "You'll be told about new comments on this post." : "You won't be told about this post any more."),
    /** The phone's share sheet; once shared, the post's count goes up (each neighbour counts once). */
    share: async (post: ApiPost) => {
      const shared = await shareLink(`/p/${post._id}`, `${post.author?.displayName ?? "A neighbour"} on myHoodora: ${(post.message ?? post.content).slice(0, 120)}`);
      if (!shared) return;
      // Counting is a nicety: a failure here never bothers the person who just shared.
      const res = await recordShare(user, post._id).catch(() => null);
      if (res) updatePostEverywhere(client, post._id, (p) => ({ ...p, shareCount: res.shareCount }));
    },
  };
}
