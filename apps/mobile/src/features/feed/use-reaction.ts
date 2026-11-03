import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost, ReactionType } from "@myhoodora/api-contract/types";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { feedKeys, isAd, setReaction, updateFeedEntries } from "./feed-api";
import { nextToSend, withReaction, type ReactionSync } from "./reactions";

/** Every cached copy of the post (each feed filter, and its own page), changed the same way. */
export function updatePostEverywhere(client: QueryClient, id: string, change: (post: ApiPost) => ApiPost) {
  updateFeedEntries(client, (entries) => entries.map((e) => (!isAd(e) && e._id === id ? change(e) : e)));
  client.setQueryData<ApiPost>(feedKeys.post(id), (p) => (p ? change(p) : p));
}

const syncs = new Map<string, ReactionSync>();

interface Deps {
  user: Parameters<typeof setReaction>[0];
  client: QueryClient;
  toast: (message: string, tone?: "error") => void;
}

/** Sends what's wanted for one post, one request at a time, until the API has your latest choice. */
async function pump(id: string, deps: Deps): Promise<void> {
  const sync = syncs.get(id);
  const next = sync && nextToSend(sync);
  if (!sync || !next) {
    if (sync && !sync.sending) syncs.delete(id);
    return;
  }
  sync.sending = true;
  try {
    const fresh = await setReaction(deps.user, id, next.type);
    sync.confirmed = fresh;
    sync.sending = false;
    // Only take the API's copy if you haven't changed your mind meanwhile; otherwise the loop sends that.
    if (sync.wanted === (fresh.myReaction ?? null)) updatePostEverywhere(deps.client, id, (p) => ({ ...p, ...fresh }));
    await pump(id, deps);
  } catch (err) {
    syncs.delete(id);
    updatePostEverywhere(deps.client, id, () => sync.confirmed);
    deps.toast(errorMessage(err), "error");
  }
}

/**
 * React, change your reaction or take it back (`null`). Every tap shows at once, however fast and
 * whatever is still on its way: one request at a time goes out per post, and when it's back the next
 * carries only your latest choice (like, unlike, like = one request). If the API refuses, the post
 * goes back to what it last confirmed, with a message.
 */
export function useReaction() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  return useCallback(
    (post: ApiPost, type: ReactionType | null) => {
      const sync = syncs.get(post._id) ?? { wanted: post.myReaction ?? null, confirmed: post, sending: false };
      syncs.set(post._id, sync);
      sync.wanted = type;
      // A refetch landing now would put the old state back for a moment.
      void client.cancelQueries({ queryKey: feedKeys.all });
      updatePostEverywhere(client, post._id, (p) => withReaction(p, type));
      void pump(post._id, { user, client, toast });
    },
    [client, toast, user],
  );
}
