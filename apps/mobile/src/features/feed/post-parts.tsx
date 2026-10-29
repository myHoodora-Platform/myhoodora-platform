import type { ApiPost, PostCategory, ReactionType } from "@myhoodora/api-contract/types";
import { CheckCircle2, MapPin, MessageCircle, Share2, ThumbsUp } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { fonts, MIN_TOUCH, tint, useTheme, type Theme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { useAuth } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { pickerLayout, ReactionPicker, reactionAt } from "./reaction-picker";
import { REACTIONS, reactionDef, topReactions } from "./reactions";
import { usePostActions } from "./use-post-actions";
import { useReaction } from "./use-reaction";

export { PostMenuButton } from "./post-menu";

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

/** Avatar, name, and "Neighbourhood · 2h". Tapping the face or name opens who posted, when `onAuthor` is given. */
export function PostAuthor({ post, size = 40, compact = false, onAuthor, onAuthorLongPress }: { post: ApiPost; size?: number; compact?: boolean; onAuthor?: () => void; onAuthorLongPress?: () => void }) {
  const t = useTheme();
  const name = post.author?.displayName ?? "myHoodora user";
  const meta = [post.author?.neighborhoodName, timeAgo(post.createdAt), post.editedAt ? "Edited" : null].filter(Boolean).join(" · ");
  const body = (
    <>
      <Avatar name={post.author?.displayName} photoURL={post.author?.photoURL} size={size} />
      <View style={styles.shrink}>
        <Text variant="label" style={compact ? undefined : styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.row}>
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.shrink}>
            {meta}
          </Text>
          {!compact ? <MapPin size={12} color={t.colors.mutedForeground} accessibilityLabel="Neighbours only" /> : null}
        </View>
      </View>
    </>
  );
  if (!onAuthor || !post.author) return <View style={styles.author}>{body}</View>;
  return (
    <Pressable
      onPress={onAuthor}
      onLongPress={onAuthorLongPress}
      delayLongPress={350}
      accessibilityRole="link"
      accessibilityLabel={`${name}. ${meta}`}
      accessibilityHint="Opens their profile"
      accessibilityActions={onAuthorLongPress ? [{ name: "activate" }, { name: "longpress", label: "Preview their profile" }] : undefined}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? onAuthorLongPress?.() : onAuthor())}
      hitSlop={4}
      style={({ pressed }) => [styles.author, { opacity: pressed ? 0.7 : 1 }]}>
      {body}
    </Pressable>
  );
}

/**
 * Above an alert's text: "Resolved" once it's over, and where it is (tap for the alerts map). The text
 * itself is SeeMoreText in the feed, plain on the post's page.
 */
export function PostResolved({ post }: { post: ApiPost }) {
  const t = useTheme();
  const router = useRouter();
  const place = post.category === "alert" ? post.location : undefined;
  if (!post.resolvedAt && !place) return null;
  return (
    <View style={styles.alertLines}>
      {post.resolvedAt ? (
        <View style={styles.row}>
          <CheckCircle2 size={16} color={t.colors.success} />
          <Text variant="caption" tone="success">
            Resolved
          </Text>
        </View>
      ) : null}
      {place ? (
        <Pressable onPress={() => router.push("/alerts/map")} accessibilityRole="link" accessibilityLabel={`Where: ${place.label ?? "pinned on the map"}. Opens the alerts map`} style={styles.row} hitSlop={6}>
          <MapPin size={16} color={t.colors.destructive} />
          <Text variant="caption" style={[styles.shrink, { color: t.colors.foreground, fontFamily: t.fonts.semibold }]} numberOfLines={1}>
            {place.label ?? "On the map"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Resolved" on an alert that's over, then the whole text. */
export function PostText({ post, lines, size = 16 }: { post: ApiPost; lines?: number; size?: number }) {
  return (
    <>
      <PostResolved post={post} />
      <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.45) }} numberOfLines={lines} selectable>
        {postText(post)}
      </Text>
    </>
  );
}

/** Left: the top reactions and how many; right: "N comments" (opens them) and "N shares". A zero is never shown. */
export function PostCounts({ post, onComments }: { post: ApiPost; onComments?: () => void }) {
  const t = useTheme();
  const reactions = post.reactionTotal ?? 0;
  const comments = post.commentCount ?? 0;
  const shares = post.shareCount ?? 0;
  if (!reactions && !comments && !shares) return null;
  const top = topReactions(post.reactionCounts);
  return (
    <View style={styles.counts}>
      {reactions ? (
        <View style={styles.row} accessible accessibilityLabel={`${reactions} ${reactions === 1 ? "reaction" : "reactions"}`}>
          <View style={styles.faces}>
            {top.map((id, i) => (
              <View key={id} style={[styles.face, { backgroundColor: t.colors.card, borderColor: t.colors.card, marginLeft: i ? -6 : 0, zIndex: 3 - i }]}>
                <Text style={styles.faceEmoji}>{reactionDef(id).emoji}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" tone="muted">
            {reactions}
          </Text>
        </View>
      ) : (
        <View />
      )}
      <View style={styles.row}>
        {comments ? (
          <Pressable onPress={onComments} disabled={!onComments} accessibilityRole="button" hitSlop={8}>
            <Text variant="caption" tone="muted">
              {comments} {comments === 1 ? "comment" : "comments"}
            </Text>
          </Pressable>
        ) : null}
        {comments && shares ? (
          <Text variant="caption" tone="muted">
            ·
          </Text>
        ) : null}
        {shares ? (
          <Text variant="caption" tone="muted">
            {shares} {shares === 1 ? "share" : "shares"}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Like · Comment · Share, equal width. Like toggles your reaction (whichever it is) and long-press picks
 * one; taps are ignored while one is on its way. Read-only in a neighbourhood you only follow.
 */
export function PostActionBar({ post, onComment }: { post: ApiPost; onComment?: () => void }) {
  const t = useTheme();
  const { profile } = useAuth();
  // A neighbourhood they only follow: read and share, but reacting stays at home (contract §31).
  const readOnly = !!profile?.neighborhoodId && post.neighborhoodId !== profile.neighborhoodId;
  const react = useReaction();
  const { share } = usePostActions();
  const likeRef = useRef<View>(null);
  const { width } = useWindowDimensions();
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const mine = post.myReaction ?? null;
  const def = mine ? reactionDef(mine) : null;
  // Never ignored: each tap shows at once and only your latest choice is sent (useReaction).
  const send = (type: ReactionType | null) => react(post, type);
  const toggle = () => send(mine ? null : "like");
  const openPicker = () => likeRef.current?.measureInWindow((x, y) => setPicker({ x, y }));
  // Press and hold, then slide along the row and let go on a reaction (or let go elsewhere and tap one).
  const slide = (x: number, y: number) => setHovered(picker ? reactionAt(x, y, pickerLayout(picker, width)) : null);
  const release = () => {
    if (hovered !== null) {
      const chosen = REACTIONS[hovered]!.id;
      setPicker(null);
      send(chosen === mine ? null : chosen);
    }
    setHovered(null);
  };
  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .activateAfterLongPress(300)
      .enabled(!readOnly)
      .runOnJS(true)
      // The button's corner on screen: where the finger is, less where it is within the button.
      .onStart((e) => setPicker({ x: e.absoluteX - e.x, y: e.absoluteY - e.y }))
      .onUpdate((e) => slide(e.absoluteX, e.absoluteY))
      .onEnd(release),
    Gesture.Tap().enabled(!readOnly).runOnJS(true).onEnd((_e, ok) => ok && toggle()),
  );
  const color = t.colors.mutedForeground;
  return (
    <View style={[styles.bar, { borderTopColor: t.colors.border }]}>
      <GestureDetector gesture={gesture}>
        <View
          ref={likeRef}
          collapsable={false}
          accessible
          accessibilityRole="button"
          accessibilityLabel={def ? `${def.label}. Take your reaction back` : "Like"}
          accessibilityHint={readOnly ? "You can react in your home neighbourhood" : "Hold for more reactions"}
          accessibilityState={{ selected: !!mine, disabled: readOnly }}
          accessibilityActions={readOnly ? undefined : [{ name: "activate" }, { name: "longpress", label: "Choose a reaction" }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? openPicker() : !readOnly && toggle())}
          style={[styles.barItem, readOnly && styles.dim]}
        >
          {def && def.id !== "like" ? <Text style={styles.barEmoji}>{def.emoji}</Text> : <ThumbsUp size={20} color={mine ? t.colors.primary : color} fill={mine ? tint(t.colors.primary, 0.2) : "transparent"} />}
          <Text variant="label" style={{ color: mine ? t.colors.primary : color }}>
            {def?.label ?? "Like"}
          </Text>
        </View>
      </GestureDetector>
      <Pressable onPress={onComment} disabled={!onComment} accessibilityRole="button" accessibilityLabel="Comment" style={({ pressed }) => [styles.barItem, pressed && { backgroundColor: t.colors.muted }]}>
        <MessageCircle size={20} color={color} />
        <Text variant="label" style={{ color }}>
          Comment
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void share(post)}
        accessibilityRole="button"
        accessibilityLabel="Share"
        style={({ pressed }) => [styles.barItem, pressed && { backgroundColor: t.colors.muted }]}
      >
        <Share2 size={19} color={color} />
        <Text variant="label" style={{ color }}>
          Share
        </Text>
      </Pressable>
      <ReactionPicker anchor={picker} screenWidth={width} hovered={hovered} current={mine} onPick={send} onClose={() => setPicker(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  author: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  name: { fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  alertLines: { gap: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontFamily: fonts.semibold },
  counts: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, minHeight: 32 },
  faces: { flexDirection: "row" },
  face: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  faceEmoji: { fontSize: 12, lineHeight: 16 },
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 12, paddingVertical: 2 },
  barItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: MIN_TOUCH - 4, borderRadius: 10 },
  barEmoji: { fontSize: 18, lineHeight: 22 },
  dim: { opacity: 0.5 },
});
