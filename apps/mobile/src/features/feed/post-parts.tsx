import type { ApiPost, PostCategory } from "@myhoodora/api-contract/types";
import { CheckCircle2, Ellipsis, Heart, MessageCircle, Share2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fonts, MIN_TOUCH, tint, useTheme, type Theme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { shareLink } from "@/shared/utils/share";
import { timeAgo } from "@/shared/utils/time";
import { ReportSheet } from "./report-sheet";
import { useAuth } from "@/core/auth/auth-provider";
import { useLike } from "./use-like";

/**
 * The pieces of a post, shared by the feed's card and the post's own screen so both read the same:
 * who wrote it, what kind it is, the text, and what you can do with it.
 */

/** Badge wording from the web (apps/web/src/features/feed/categories.ts). */
const BADGE: Record<PostCategory, string> = {
  general: "General",
  recommendation: "Recommendation",
  alert: "Alert",
  event: "Event",
  for_sale: "For sale",
  lost_found: "Lost & found",
  poll: "Poll",
  thanks: "Thanks",
};

/** Soft background and strong text per kind, from the shared tokens (alerts read as alerts at a glance). */
function badgeTone(category: PostCategory, t: Theme): { bg: string; fg: string } {
  if (category === "alert") return { bg: t.colors.dangerSoft, fg: t.colors.destructive };
  if (category === "for_sale" || category === "lost_found") return { bg: t.colors.warningSoft, fg: t.colors.warning };
  if (category === "event") return { bg: t.colors.infoSoft, fg: t.colors.info };
  return { bg: tint(t.colors.primary), fg: t.colors.primary };
}

export function postText(post: ApiPost): string {
  return post.message ?? post.content;
}

export const isUrgent = (post: ApiPost) => post.category === "alert" && !!post.urgent && !post.resolvedAt;

/** "Urgent" in red, or the kind of post; nothing for a general post. */
export function CategoryBadge({ post }: { post: ApiPost }) {
  const t = useTheme();
  if (isUrgent(post)) {
    return (
      <View style={[styles.pill, { backgroundColor: t.colors.destructive }]}>
        <Text variant="caption" style={[styles.pillText, { color: t.colors.destructiveForeground }]}>
          Urgent
        </Text>
      </View>
    );
  }
  if (!post.category || post.category === "general") return null;
  const tone = badgeTone(post.category, t);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text variant="caption" style={[styles.pillText, { color: tone.fg }]}>
        {BADGE[post.category]}
      </Text>
    </View>
  );
}

/** Avatar, name, and "Neighbourhood · 2h". */
export function PostAuthor({ post, size = 44, compact = false }: { post: ApiPost; size?: number; compact?: boolean }) {
  return (
    <View style={styles.author}>
      <Avatar name={post.author?.displayName} photoURL={post.author?.photoURL} size={size} />
      <View style={styles.shrink}>
        <Text variant="label" style={compact ? undefined : styles.name} numberOfLines={1}>
          {post.author?.displayName ?? "A neighbour"}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[post.author?.neighborhoodName, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

/** "Resolved" on an alert that's over, then the text. */
export function PostText({ post, lines, size = 16 }: { post: ApiPost; lines?: number; size?: number }) {
  const t = useTheme();
  return (
    <>
      {post.resolvedAt ? (
        <View style={styles.row}>
          <CheckCircle2 size={16} color={t.colors.success} />
          <Text variant="caption" tone="success">
            Resolved
          </Text>
        </View>
      ) : null}
      <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.45) }} numberOfLines={lines}>
        {postText(post)}
      </Text>
    </>
  );
}

/**
 * Like (in place, optimistic), comments, share and the "…" menu (report). `onComment` opens the post
 * from the feed, and focuses the reply box on the post's own screen.
 */
export function PostActions({ post, onComment, showMore = true }: { post: ApiPost; onComment?: () => void; showMore?: boolean }) {
  const t = useTheme();
  const { profile } = useAuth();
  // A neighbourhood they only follow: read and share, but liking stays at home (contract §31).
  const readOnly = !!profile?.neighborhoodId && post.neighborhoodId !== profile.neighborhoodId;
  const like = useLike();
  const [reporting, setReporting] = useState(false);
  const liked = !!post.myReaction;
  const reactions = post.reactionTotal ?? 0;
  const comments = post.commentCount ?? 0;
  const pressed = (on: boolean) => ({ backgroundColor: on ? t.colors.muted : "transparent" });
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={() => like.mutate({ post, liked: !liked })}
        disabled={like.isPending || readOnly}
        accessibilityRole="button"
        accessibilityLabel={liked ? "Remove your like" : "Like"}
        accessibilityValue={{ text: `${reactions} ${reactions === 1 ? "reaction" : "reactions"}` }}
        accessibilityState={{ selected: liked }}
        hitSlop={6}
        style={({ pressed: p }) => [styles.action, pressed(p)]}
      >
        <Heart size={20} color={liked ? t.colors.destructive : t.colors.mutedForeground} fill={liked ? t.colors.destructive : "transparent"} />
        <Text variant="label" tone="muted">
          {reactions}
        </Text>
      </Pressable>
      <Pressable
        onPress={onComment}
        disabled={!onComment}
        accessibilityRole="button"
        accessibilityLabel={`${comments} ${comments === 1 ? "comment" : "comments"}`}
        accessibilityHint={onComment ? "Write a comment" : undefined}
        hitSlop={6}
        style={({ pressed: p }) => [styles.action, pressed(p && !!onComment)]}
      >
        <MessageCircle size={20} color={t.colors.mutedForeground} />
        <Text variant="label" tone="muted">
          {comments}
        </Text>
      </Pressable>
      <View style={styles.flex} />
      <Pressable
        onPress={() => void shareLink(`/p/${post._id}`, `${post.author?.displayName ?? "A neighbour"} on myHoodora: ${postText(post).slice(0, 120)}`)}
        accessibilityRole="button"
        accessibilityLabel="Share"
        hitSlop={6}
        style={({ pressed: p }) => [styles.iconAction, pressed(p)]}
      >
        <Share2 size={19} color={t.colors.mutedForeground} />
      </Pressable>
      {showMore ? (
        <>
          <Pressable onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel="More options" hitSlop={6} style={({ pressed: p }) => [styles.iconAction, pressed(p)]}>
            <Ellipsis size={20} color={t.colors.mutedForeground} />
          </Pressable>
          <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post._id} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  author: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  name: { fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontFamily: fonts.semibold },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconAction: { width: MIN_TOUCH - 4, height: MIN_TOUCH - 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: MIN_TOUCH - 4, paddingHorizontal: 10, borderRadius: 999 },
});
