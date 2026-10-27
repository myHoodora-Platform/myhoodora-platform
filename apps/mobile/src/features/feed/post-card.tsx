import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { feedKeys, listComments } from "./feed-api";
import { MediaGrid } from "./media-grid";
import { CategoryBadge, isUrgent, PostActionBar, PostAuthor, PostCounts, PostMenuButton, PostResolved, postText } from "./post-parts";
import { FEED_LINES } from "./see-more";
import { SeeMoreText } from "./see-more-text";

export { postText } from "./post-parts";

/**
 * One post in a list (feed, search), edge to edge: who posted (tap for their profile, hold for a
 * preview), the text
 * ("See more" when it overflows), photos, counts and Like · Comment · Share. Tapping the text area opens
 * the post. Memoised: the feed re-renders often while paging.
 */
export const PostCard = memo(function PostCard({ post, onComments }: { post: ApiPost; onComments?: (post: ApiPost) => void }) {
  const t = useTheme();
  const openProfile = useOpenProfile();
  const [preview, setPreview] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  const user = useSignedInUser();
  const open = () => router.push(`/p/${post._id}`);
  // Start loading the comments on touch-down: by the time they open they're on their way.
  const warm = () => void client.prefetchQuery({ queryKey: feedKeys.comments(post._id), queryFn: () => listComments(user, post._id), staleTime: 30_000 });
  // Comments slide up in a sheet over the feed.
  const comments = onComments ? () => onComments(post) : () => router.push(`/p/${post._id}/comments`);
  const urgent = isUrgent(post);
  const text = postText(post).trim();

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, urgent && { borderLeftWidth: 4, borderLeftColor: t.colors.destructive }]}>
      <View style={styles.header}>
        {/* A departed author ("myHoodora user") has no profile to open. */}
        <PostAuthor post={post} onAuthor={post.author ? () => openProfile(post.authorUid) : undefined} onAuthorLongPress={post.author ? () => setPreview(true) : undefined} />
        <View style={styles.headerEnd}>
          <CategoryBadge post={post} />
          <PostMenuButton post={post} />
        </View>
      </View>
      {text || post.resolvedAt ? (
        <Pressable onPress={open} onPressIn={warm} accessibilityRole="link" accessibilityHint="Opens the post" style={styles.body}>
          <PostResolved post={post} />
          {text ? <SeeMoreText id={post._id} text={text} lines={FEED_LINES} style={styles.text} onOpenPost={open} /> : null}
        </Pressable>
      ) : null}
      {post.mediaUrls.length ? <MediaGrid urls={post.mediaUrls} aspects={post.mediaAspects} recyclingKey={post._id} /> : null}
      <PostCounts post={post} onComments={comments} />
      <PostActionBar post={post} onComment={comments} />
      {preview ? <ProfilePreview uid={post.authorUid} onClose={() => setPreview(false)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingBottom: 4, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 16, paddingRight: 8 },
  headerEnd: { flexDirection: "row", alignItems: "center", gap: 4 },
  body: { paddingHorizontal: 16, gap: 6 },
  text: { fontSize: 16, lineHeight: 23 },
});
