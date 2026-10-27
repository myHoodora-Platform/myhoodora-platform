import type { ApiPost, Comment, CommentSort } from "@myhoodora/api-contract/types";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Circle, CircleDot, MessageCircle, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { cachedPost, feedKeys, getPost, listThread, nextOffset } from "@/features/feed/feed-api";
import { reactionDef, topReactions } from "@/features/feed/reactions";
import { useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { ErrorState } from "@/shared/ui/states";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";
import { CommentItem, PendingItem } from "./comment-item";
import { commentDrafts, type Draft } from "./comment-drafts";
import { Replies } from "./replies";
import { ThreadComposer } from "./thread-composer";
import { useCommentLike } from "./use-comment-like";
import { useSendComment } from "./use-send-comment";

/** The orders the API offers (contract §2), in its words for people. */
const SORTS: { id: CommentSort; label: string; hint: string }[] = [
  { id: "top", label: "Most relevant", hint: "Conversations and the most liked comments first." },
  { id: "newest", label: "Newest", hint: "All comments, the newest first." },
  { id: "oldest", label: "Oldest", hint: "All comments, in the order they were written." },
];

/** "👍😂 536" or "Be the first to like this", and "12 comments", with a close button. */
function SheetHeader({ post, onClose }: { post?: ApiPost; onClose: () => void }) {
  const t = useTheme();
  const total = post?.reactionTotal ?? 0;
  const comments = post?.commentCount ?? 0;
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        {total ? (
          <View style={styles.faces} accessible accessibilityLabel={`${total} ${total === 1 ? "reaction" : "reactions"}`}>
            {topReactions(post?.reactionCounts).map((id) => (
              <Text key={id} style={styles.face}>
                {reactionDef(id).emoji}
              </Text>
            ))}
            <Text variant="label">{total}</Text>
          </View>
        ) : (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Be the first to react to this
          </Text>
        )}
        <View style={styles.flex} />
        {comments ? (
          <Text variant="caption" tone="muted">
            {comments} {comments === 1 ? "comment" : "comments"}
          </Text>
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments" hitSlop={10} style={styles.close}>
          <X size={20} color={t.colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
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

/**
 * `/p/<id>/comments`: the conversation in a sheet over the feed (opens at 60% of the screen, drag
 * the top up to 95%; closes by dragging down, the backdrop, the X or Android back). Top-level comments in the
 * chosen order with their replies folded under each, likes, replying one level deep, your comments
 * shown at once while they send, and the reply box above the keyboard.
 */
export function CommentsSheet({ id }: { id: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const input = useRef<TextInput>(null);
  const [sort, setSort] = useState<CommentSort>("top");
  const [sorting, setSorting] = useState(false);
  const [replyTo, setReplyTo] = useState<Draft["replyTo"]>(() => commentDrafts.get(id).replyTo);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  // The thread's height once loaded, so the sheet fits a short one (BottomSheet).
  const [listHeight, setListHeight] = useState<number | undefined>(undefined);

  const post = useQuery({ queryKey: feedKeys.post(id), queryFn: () => getPost(user, id), placeholderData: () => cachedPost(client, id) });
  const thread = useInfiniteQuery({
    queryKey: feedKeys.thread(id, sort),
    queryFn: ({ pageParam }) => listThread(user, id, { sort, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });
  const { pending, send, retry, discard } = useSendComment({ _id: id });
  const like = useCommentLike(id);
  const roots = useMemo(() => thread.data?.pages.flat() ?? [], [thread.data]);
  const mine = { name: profile?.displayName, photoURL: profile?.photoURL };

  const reply = useCallback((c: Comment) => {
    setReplyTo({ commentId: c._id, rootId: c.parentId ?? c._id, name: c.author?.displayName ?? "this neighbour" });
    setTimeout(() => input.current?.focus(), 50);
  }, []);
  const sendAndShow = useCallback(
    (text: string, to?: Draft["replyTo"]) => {
      const sent = send(text, to);
      if (sent && to) setAnswered((s) => new Set(s).add(to.rootId));
      return sent;
    },
    [send],
  );

  const pendingRoots = pending.filter((p) => !p.rootId);
  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <View>
        <CommentItem comment={item} postId={id} onReply={reply} onLike={like} />
        <Replies parent={item} postId={id} open={answered.has(item._id)} onReply={reply} onLike={like} />
        {pending
          .filter((p) => p.rootId === item._id)
          .map((p) => (
            <PendingItem key={p.clientId} p={p} avatar={mine} onRetry={() => retry(p.clientId)} onDiscard={() => discard(p.clientId)} />
          ))}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `mine` is derived from profile each render
    [id, reply, like, answered, pending, retry, discard, profile?.displayName, profile?.photoURL],
  );

  const current = SORTS.find((s) => s.id === sort)!;
  return (
    <BottomSheet
      label="Comments"
      onClose={() => router.back()}
      contentHeight={thread.isPending ? undefined : listHeight}
      header={(close) => <SheetHeader post={post.data} onClose={close} />}
      footer={post.data ? <ThreadComposer ref={input} post={post.data} replyTo={replyTo} onCancelReply={() => setReplyTo(undefined)} send={sendAndShow} /> : undefined}
    >
      <FlatList
        style={styles.flex}
        data={roots}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            {roots.length > 1 ? (
              <Pressable onPress={() => setSorting(true)} accessibilityRole="button" accessibilityLabel={`Sorted by ${current.label}. Change`} hitSlop={6} style={styles.sort}>
                <Text variant="label">{current.label}</Text>
                <ChevronDown size={18} color={t.colors.foreground} />
              </Pressable>
            ) : null}
            {pendingRoots.map((p) => (
              <PendingItem key={p.clientId} p={p} avatar={mine} onRetry={() => retry(p.clientId)} onDiscard={() => discard(p.clientId)} />
            ))}
          </>
        }
        ListEmptyComponent={
          thread.isPending ? (
            <LoadingComments />
          ) : thread.isError ? (
            <ErrorState error={thread.error} onRetry={() => void thread.refetch()} title="Comments didn't load" />
          ) : pendingRoots.length ? null : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: t.colors.accent }]}>
                <MessageCircle size={36} color={t.colors.primary} />
              </View>
              <Text variant="heading">No comments yet</Text>
              <Text tone="muted">Be the first to comment.</Text>
            </View>
          )
        }
        ListFooterComponent={
          thread.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={t.colors.primary} accessibilityLabel="Loading more comments" />
          ) : thread.isFetchNextPageError ? (
            <ErrorState error={thread.error} onRetry={() => void thread.fetchNextPage()} title="Couldn't load more" />
          ) : null
        }
        onEndReached={() => thread.hasNextPage && !thread.isFetchingNextPage && !thread.isFetchNextPageError && void thread.fetchNextPage()}
        onEndReachedThreshold={0.4}
        onContentSizeChange={(_w, h) => setListHeight(h)}
        contentContainerStyle={styles.list}
      />
      <ActionSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        label="Sort comments"
        groups={[
          SORTS.map((s) => ({
            key: s.id,
            label: s.label,
            hint: s.hint,
            Icon: s.id === sort ? CircleDot : Circle,
            onPress: () => setSort(s.id),
          })),
        ]}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 16 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  faces: { flexDirection: "row", alignItems: "center", gap: 2 },
  face: { fontSize: 16, lineHeight: 20 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  list: { paddingBottom: 12 },
  loading: { padding: 16, gap: 16 },
  loadingRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  footer: { paddingVertical: 16 },
});
