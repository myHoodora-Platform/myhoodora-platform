import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost, ReactionType } from "@myhoodora/api-contract/types";
import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { feedKeys, setReaction } from "./feed-api";
import { withReaction } from "./reactions";

type FeedPages = InfiniteData<ApiPost[], string | undefined>;

/** Every cached copy of the post (each feed filter, and its own page), changed the same way. */
export function updatePostEverywhere(client: QueryClient, id: string, change: (post: ApiPost) => ApiPost) {
  client.setQueriesData<FeedPages>({ queryKey: feedKeys.all }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.map((p) => (p._id === id ? change(p) : p))) } : data,
  );
  client.setQueryData<ApiPost>(feedKeys.post(id), (p) => (p ? change(p) : p));
}

/**
 * React, change your reaction or take it back (`null`), optimistically: the bar changes on tap, and goes
 * back (with a message) if the API refuses. One reaction per neighbour that can be undone, so rolling
 * back is always safe. Callers ignore taps while `isPending`, so one post never has two in flight.
 */
export function useReaction() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ post, type }: { post: ApiPost; type: ReactionType | null }) => setReaction(user, post._id, type),
    onMutate: async ({ post, type }) => {
      await client.cancelQueries({ queryKey: feedKeys.all });
      updatePostEverywhere(client, post._id, (p) => withReaction(p, type));
      return { before: post };
    },
    onError: (err, { post }, context) => {
      updatePostEverywhere(client, post._id, () => context?.before ?? post);
      toast(errorMessage(err), "error");
    },
    onSuccess: (fresh) => updatePostEverywhere(client, fresh._id, (p) => ({ ...p, ...fresh })),
  });
}
