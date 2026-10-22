import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { feedKeys, setLiked } from "./feed-api";
import { withLike } from "./reactions";

type FeedPages = InfiniteData<ApiPost[], string | undefined>;

/** Every cached copy of the post (each feed filter, and its own page), changed the same way. */
function updateEverywhere(client: QueryClient, id: string, change: (post: ApiPost) => ApiPost) {
  client.setQueriesData<FeedPages>({ queryKey: feedKeys.all }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.map((p) => (p._id === id ? change(p) : p))) } : data,
  );
  client.setQueryData<ApiPost>(feedKeys.post(id), (p) => (p ? change(p) : p));
}

/**
 * Like or un-like, optimistically: the heart changes on tap, and goes back (with a message) if the API
 * refuses. A reaction is one per neighbour and can be undone, so rolling back is always safe.
 */
export function useLike() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ post, liked }: { post: ApiPost; liked: boolean }) => setLiked(user, post._id, liked),
    onMutate: async ({ post, liked }) => {
      await client.cancelQueries({ queryKey: feedKeys.all });
      updateEverywhere(client, post._id, (p) => withLike(p, liked));
      return { before: post };
    },
    onError: (err, { post }, context) => {
      updateEverywhere(client, post._id, () => context?.before ?? post);
      toast(errorMessage(err), "error");
    },
    onSuccess: (fresh) => updateEverywhere(client, fresh._id, (p) => ({ ...p, ...fresh })),
  });
}
