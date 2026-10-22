import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { clampAspect } from "@/shared/ui/photo-pager";
import { Text } from "@/shared/ui/text";
import { feedKeys, listComments } from "./feed-api";
import { CategoryBadge, isUrgent, PostActions, PostAuthor, PostText } from "./post-parts";

export { postText } from "./post-parts";

/**
 * One post in a list (feed, search). The whole card opens it; the heart likes it in place. Memoised:
 * the feed re-renders often while paging.
 */
export const PostCard = memo(function PostCard({ post }: { post: ApiPost }) {
  const t = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const user = useSignedInUser();
  const open = () => router.push(`/p/${post._id}`);
  // Start loading the comments on touch-down: by the time the post screen opens they're on their way.
  const warm = () => void client.prefetchQuery({ queryKey: feedKeys.comments(post._id), queryFn: () => listComments(user, post._id), staleTime: 30_000 });
  const more = post.mediaUrls.length - 1;

  return (
    <Pressable onPress={open} onPressIn={warm} accessibilityRole="link" accessibilityHint="Opens the post and its comments" style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: isUrgent(post) ? t.colors.destructive : "transparent" }, t.scheme === "light" && styles.shadow]}>
        <View style={styles.header}>
          <PostAuthor post={post} />
          <CategoryBadge post={post} />
        </View>
        <PostText post={post} lines={8} />
        {post.mediaUrls[0] ? (
          <View>
            <Image
              source={post.mediaUrls[0]}
              accessibilityLabel={more > 0 ? `Photo, and ${more} more` : "Photo in the post"}
              style={[styles.media, { aspectRatio: clampAspect(post.mediaAspects?.[0]), backgroundColor: t.colors.muted }]}
              contentFit="cover"
              transition={150}
              recyclingKey={post._id}
            />
            {more > 0 ? (
              <View style={styles.more}>
                <Text variant="caption" style={styles.moreText}>
                  +{more}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.divider, { backgroundColor: t.colors.border }]} />
        <PostActions post={post} onComment={open} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 16, gap: 12, borderWidth: 1.5 },
  shadow: { shadowColor: "#0b1716", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  media: { width: "100%", borderRadius: 16 },
  more: { position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  moreText: { color: "#ffffff" },
  divider: { height: StyleSheet.hairlineWidth, marginTop: -2 },
});
