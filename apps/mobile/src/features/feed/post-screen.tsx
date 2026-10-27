import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { FlatList, StyleSheet, View, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { ThreadComposer } from "@/features/comments/thread-composer";
import { loadMore, ThreadEmpty, ThreadHead, ThreadMore, useThread, type Thread } from "@/features/comments/use-thread";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { PhotoPager } from "@/shared/ui/photo-pager";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { cachedPost, feedKeys, getPost } from "./feed-api";
import { CategoryBadge, PostActionBar, PostAuthor, PostCounts, PostMenuButton, PostText } from "./post-parts";

/** The post itself: text, photos edge to edge, then what you can do with it, then "Comments". */
function PostBody({ post, onComment }: { post: ApiPost; onComment: () => void }) {
  const t = useTheme();
  const count = post.commentCount ?? 0;
  return (
    <View style={{ backgroundColor: t.colors.background }}>
      <View style={styles.text}>
        <CategoryBadge post={post} />
        <PostText post={post} size={17} />
      </View>
      <PhotoPager photos={post.mediaUrls} aspects={post.mediaAspects} label="Photo in the post" />
      <View style={[styles.actions, { borderBottomColor: t.colors.border }]}>
        <PostCounts post={post} onComments={onComment} />
        <PostActionBar post={post} onComment={onComment} />
      </View>
      <Text variant="heading" style={styles.commentsHead}>
        Comments{count ? ` (${count})` : ""}
      </Text>
    </View>
  );
}

function PostList({ post, thread, onComment }: { post: ApiPost; thread: Thread; onComment: () => void }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const focus = onComment;
  return (
    <FlatList
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
      scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      data={thread.roots}
      keyExtractor={(c) => c._id}
      renderItem={thread.renderItem}
      ListHeaderComponent={
        <>
          <PostBody post={post} onComment={focus} />
          <ThreadHead thread={thread} />
        </>
      }
      ListEmptyComponent={<ThreadEmpty thread={thread} onComment={focus} />}
      ListFooterComponent={<ThreadMore thread={thread} />}
      onEndReached={() => loadMore(thread)}
      onEndReachedThreshold={0.4}
    />
  );
}

/**
 * `/p/<id>`: one post and its conversation (the same thread as the comments sheet: sorted, replies
 * under each comment, likes). Opens at once with the feed's copy (refreshed quietly), the author sits
 * in the header, and the reply box stays above the keyboard.
 */
export function PostScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const safe = useSafeAreaInsets();
  const post = useQuery({ queryKey: feedKeys.post(id), queryFn: () => getPost(user, id), placeholderData: () => cachedPost(client, id) });
  const input = useRef<TextInput>(null);
  const thread = useThread(id, input);
  const router = useRouter();
  const openProfile = useOpenProfile();

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
      center={<PostAuthor post={post.data} size={34} compact onAuthor={post.data.author ? () => openProfile(post.data!.authorUid) : undefined} />}
      right={<PostMenuButton post={post.data} onDeleted={() => router.back()} />}
      footer={<ThreadComposer ref={input} post={post.data} replyTo={thread.replyTo} onCancelReply={() => thread.setReplyTo(undefined)} send={thread.send} safeBottom={safe.bottom} />}
    >
      <PostList post={post.data} thread={thread} onComment={() => input.current?.focus()} />
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
  actions: { paddingTop: 8, paddingBottom: 4, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  commentsHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  loading: { padding: 16, gap: 12 },
});
