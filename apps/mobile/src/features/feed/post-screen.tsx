import type { ApiPost, Comment } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { PhotoPager } from "@/shared/ui/photo-pager";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { CommentComposer } from "./comment-composer";
import { CommentRow } from "./comment-row";
import { cachedPost, feedKeys, getPost, listComments } from "./feed-api";
import { CategoryBadge, PostActions, PostAuthor, PostText } from "./post-parts";

type Order = "oldest" | "newest";

/** The post itself: text, photos edge to edge, then what you can do with it. */
function PostBody({ post, onComment, count, order, onOrder }: { post: ApiPost; onComment: () => void; count?: number; order: Order; onOrder: () => void }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background }}>
      <View style={styles.text}>
        <CategoryBadge post={post} />
        <PostText post={post} size={17} />
      </View>
      <PhotoPager photos={post.mediaUrls} aspects={post.mediaAspects} label="Photo in the post" />
      <View style={[styles.actions, { borderBottomColor: t.colors.border }]}>
        <PostActions post={post} onComment={onComment} />
      </View>
      <View style={styles.commentsHead}>
        <Text variant="heading">Comments{count !== undefined ? ` (${count})` : ""}</Text>
        {count && count > 1 ? (
          <Pressable
            onPress={onOrder}
            accessibilityRole="button"
            accessibilityLabel={`Sorted ${order} first. Change`}
            hitSlop={8}
            style={({ pressed }) => [styles.sort, { borderColor: t.colors.border, backgroundColor: pressed ? t.colors.muted : t.colors.background }]}
          >
            <ArrowUpDown size={14} color={t.colors.foreground} />
            <Text variant="caption">{order === "oldest" ? "Oldest first" : "Newest first"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PostList({ post, comments, onComment, list }: { post: ApiPost; comments: ReturnType<typeof useComments>; onComment: () => void; list: React.RefObject<FlatList<Comment> | null> }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const [order, setOrder] = useState<Order>("oldest");
  // The API sends oldest first; newest first is the same page reversed.
  const rows = useMemo(() => (order === "oldest" ? (comments.data ?? []) : [...(comments.data ?? [])].reverse()), [comments.data, order]);
  return (
    <FlatList
      ref={list}
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
      scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      data={rows}
      keyExtractor={(c) => c._id}
      renderItem={({ item }) => <CommentRow comment={item} postId={post._id} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.colors.border }]} />}
      ListHeaderComponent={<PostBody post={post} onComment={onComment} count={comments.data?.length} order={order} onOrder={() => setOrder((o) => (o === "oldest" ? "newest" : "oldest"))} />}
      ListEmptyComponent={
        comments.isPending ? (
          <ActivityIndicator style={styles.state} color={t.colors.primary} accessibilityLabel="Loading comments" />
        ) : comments.isError ? (
          <ErrorState error={comments.error} onRetry={() => void comments.refetch()} title="Comments didn't load" />
        ) : (
          <Pressable onPress={onComment} accessibilityRole="button" style={styles.state}>
            <Text tone="muted" style={styles.centre}>
              No comments yet.{" "}
              <Text tone="primary" variant="label">
                Be the first to reply.
              </Text>
            </Text>
          </Pressable>
        )
      }
    />
  );
}

function useComments(id: string) {
  const user = useSignedInUser();
  return useQuery({ queryKey: feedKeys.comments(id), queryFn: () => listComments(user, id) });
}

/**
 * `/p/<id>`: one post and its conversation. Opens at once with the feed's copy (refreshed quietly),
 * the author sits in the header, and the reply box stays above the keyboard.
 */
export function PostScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const input = useRef<TextInput>(null);
  const list = useRef<FlatList<Comment>>(null);
  const post = useQuery({ queryKey: feedKeys.post(id), queryFn: () => getPost(user, id), placeholderData: () => cachedPost(client, id) });
  const comments = useComments(id);

  if (!post.data) {
    return (
      <AppScreen title="Post" canvas={false}>
        {post.isError ? (
          // 404 covers removed posts and ones outside your Hood; the API's wording says which applies.
          <ErrorState error={post.error} onRetry={() => void post.refetch()} title="This post isn't available" />
        ) : (
          <LoadingPost />
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      canvas={false}
      center={<PostAuthor post={post.data} size={34} compact />}
      footer={<CommentComposer ref={input} post={post.data} onSent={() => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 150)} />}
    >
      <PostList post={post.data} comments={comments} onComment={() => input.current?.focus()} list={list} />
    </AppScreen>
  );
}

function LoadingPost() {
  const insets = useScreenInsets();
  return (
    <View style={[styles.loading, { paddingTop: insets.top + 16 }]} accessible accessibilityLabel="Loading the post">
      <Skeleton height={18} />
      <Skeleton width="80%" height={18} />
      <Skeleton height={260} radius={0} />
      <Skeleton width="40%" height={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  text: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 10, alignItems: "flex-start" },
  actions: { paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  commentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  state: { padding: 24 },
  centre: { textAlign: "center" },
  loading: { padding: 16, gap: 12 },
});
