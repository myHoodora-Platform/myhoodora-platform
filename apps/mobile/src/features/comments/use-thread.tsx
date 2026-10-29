import type { Comment, CommentSort } from "@myhoodora/api-contract/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, Circle, CircleDot, MessageCircle } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type TextInput } from "react-native";
import type { RefObject } from "react";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys, listThread, nextOffset } from "@/features/feed/feed-api";
import { useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { CommentItem, PendingItem } from "./comment-item";
import { commentDrafts, type Draft } from "./comment-drafts";
import { Replies } from "./replies";
import { useCommentLike } from "./use-comment-like";
import { useSendComment } from "./use-send-comment";

/** The orders the API offers (contract §2), in its words for people. */
export const SORTS: { id: CommentSort; label: string; hint: string }[] = [
  { id: "top", label: "Most relevant", hint: "Conversations and the most liked comments first." },
  { id: "newest", label: "Newest", hint: "All comments, the newest first." },
  { id: "oldest", label: "Oldest", hint: "All comments, in the order they were written." },
];

/**
 * One post's conversation, wherever it's shown (the comments sheet, the post's page): top-level
 * comments in the chosen order with their replies folded under each, likes, replying one level deep,
 * and your comments shown at once while they send. Render `renderItem` in a FlatList of `roots`, with
 * `ThreadHead`, `ThreadEmpty` and `ThreadMore` around it, and `ThreadComposer` below. `input` is that
 * composer's box (owned by the screen), focused when someone taps Reply.
 */
export function useThread(id: string, input: RefObject<TextInput | null>) {
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [sort, setSort] = useState<CommentSort>("top");
  const [replyTo, setReplyTo] = useState<Draft["replyTo"]>(() => commentDrafts.get(id).replyTo);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());

  const thread = useInfiniteQuery({
    queryKey: feedKeys.thread(id, sort),
    queryFn: ({ pageParam }) => listThread(user, id, { sort, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });
  const { pending, send, retry, discard } = useSendComment({ _id: id });
  const like = useCommentLike(id);
  const roots = useMemo(() => thread.data?.pages.flat() ?? [], [thread.data]);
  const photoURL = profile?.photoURL;
  const name = profile?.displayName;

  const reply = useCallback((c: Comment) => {
    setReplyTo({ commentId: c._id, rootId: c.parentId ?? c._id, name: c.author?.displayName ?? "this neighbour" });
    setTimeout(() => input.current?.focus(), 50);
  }, [input]);
  // A reply opens its thread, so you see it land.
  const sendAndShow = useCallback(
    (text: string, to?: Draft["replyTo"]) => {
      const sent = send(text, to);
      if (sent && to) setAnswered((s) => new Set(s).add(to.rootId));
      return sent;
    },
    [send],
  );

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <View>
        <CommentItem comment={item} postId={id} onReply={reply} onLike={like} />
        <Replies parent={item} postId={id} open={answered.has(item._id)} onReply={reply} onLike={like} />
        {pending
          .filter((p) => p.rootId === item._id)
          .map((p) => (
            <PendingItem key={p.clientId} p={p} avatar={{ name, photoURL }} onRetry={() => retry(p.clientId)} onDiscard={() => discard(p.clientId)} />
          ))}
      </View>
    ),
    [id, reply, like, answered, pending, retry, discard, name, photoURL],
  );

  return {
    sort,
    setSort,
    thread,
    roots,
    renderItem,
    replyTo,
    setReplyTo,
    send: sendAndShow,
    /** New top-level comments still sending: shown first, above the thread. */
    pendingRoots: pending.filter((p) => !p.rootId),
    me: { name, photoURL },
    retry,
    discard,
  };
}

export type Thread = ReturnType<typeof useThread>;

/** Above the comments: the order (when there's more than one to order) and your new ones still sending. */
export function ThreadHead({ thread: th }: { thread: Thread }) {
  const theme = useTheme();
  const [sorting, setSorting] = useState(false);
  const current = SORTS.find((s) => s.id === th.sort)!;
  return (
    <>
      {th.roots.length > 1 ? (
        <Pressable onPress={() => setSorting(true)} accessibilityRole="button" accessibilityLabel={`Sorted by ${current.label}. Change`} hitSlop={6} style={styles.sort}>
          <Text variant="label">{current.label}</Text>
          <ChevronDown size={18} color={theme.colors.foreground} />
        </Pressable>
      ) : null}
      {th.pendingRoots.map((p) => (
        <PendingItem key={p.clientId} p={p} avatar={th.me} onRetry={() => th.retry(p.clientId)} onDiscard={() => th.discard(p.clientId)} />
      ))}
      <ActionSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        label="Sort comments"
        groups={[SORTS.map((s) => ({ key: s.id, label: s.label, hint: s.hint, Icon: s.id === th.sort ? CircleDot : Circle, onPress: () => th.setSort(s.id) }))]}
      />
    </>
  );
}

/** No comments: loading, couldn't load, or none yet (tap to be first, when `onComment` is given). */
export function ThreadEmpty({ thread: th, onComment }: { thread: Thread; onComment?: () => void }) {
  const theme = useTheme();
  if (th.thread.isPending) return <LoadingComments />;
  if (th.thread.isError) return <ErrorState error={th.thread.error} onRetry={() => void th.thread.refetch()} title="Comments didn't load" />;
  if (th.pendingRoots.length) return null;
  return (
    <Pressable onPress={onComment} disabled={!onComment} accessibilityRole={onComment ? "button" : undefined} style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accent }]}>
        <MessageCircle size={36} color={theme.colors.primary} />
      </View>
      <Text variant="heading">No comments yet</Text>
      <Text tone="muted">Be the first to comment.</Text>
    </Pressable>
  );
}

/** Below the comments: loading the next page, or a retry if it failed. */
export function ThreadMore({ thread: th }: { thread: Thread }) {
  const theme = useTheme();
  if (th.thread.isFetchingNextPage) return <ActivityIndicator style={styles.footer} color={theme.colors.primary} accessibilityLabel="Loading more comments" />;
  if (th.thread.isFetchNextPageError) return <ErrorState error={th.thread.error} onRetry={() => void th.thread.fetchNextPage()} title="Couldn't load more" />;
  return null;
}

/** For the list's onEndReached. */
export function loadMore(th: Thread) {
  if (th.thread.hasNextPage && !th.thread.isFetchingNextPage && !th.thread.isFetchNextPageError) void th.thread.fetchNextPage();
}

function LoadingComments() {
  return (
    <View style={styles.loading} accessible accessibilityLabel="Loading comments" accessibilityState={{ busy: true }}>
      {[0.7, 0.45, 0.6].map((w, i) => (
        <View key={i} style={styles.loadingRow}>
          <Skeleton width={36} height={36} radius={18} />
          <Skeleton width={`${w * 100}%`} height={52} radius={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sort: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  loading: { padding: 16, gap: 16 },
  loadingRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  footer: { paddingVertical: 16 },
});
