import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Comment } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, ThumbsUp, Trash2 } from "lucide-react-native";
import { memo, useState } from "react";
import {Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys, deleteComment } from "@/features/feed/feed-api";
import { ReportSheet } from "@/features/feed/report-sheet";
import { SeeMoreText } from "@/features/feed/see-more-text";
import { updatePostEverywhere } from "@/features/feed/use-reaction";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { timeAgo } from "@/shared/utils/time";
import type { PendingComment } from "./use-send-comment";
import { showDialog } from "@/shared/ui/dialog";

/** Lines of a comment before "See more". */
const COMMENT_LINES = 6;

/**
 * One comment: face, name · time, the words, then Reply and its likes, with the like button on the
 * right. Long-press for its menu (delete your own, report someone else's). Replies sit indented with
 * smaller faces. A deleted comment that still has replies shows as a quiet placeholder.
 */
export const CommentItem = memo(function CommentItem({
  comment,
  postId,
  reply = false,
  onReply,
  onLike,
}: {
  comment: Comment;
  postId: string;
  reply?: boolean;
  onReply: (c: Comment) => void;
  onLike: (c: Comment) => void;
}) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const openProfile = useOpenProfile();
  const mine = comment.authorUid === user.uid;
  const size = reply ? 28 : 36;

  if (comment.deleted) {
    return (
      <View style={[styles.row, reply && styles.reply]}>
        <View style={[styles.gone, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.muted }]} />
        <Text tone="muted" style={styles.goneText}>
          This comment was deleted.
        </Text>
      </View>
    );
  }

  const remove = () =>
    showDialog("Delete your comment?", "It will be removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(user, comment._id);
            await client.invalidateQueries({ queryKey: feedKeys.comments(postId) });
            updatePostEverywhere(client, postId, (p) => ({ ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) }));
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        },
      },
    ]);

  const likes = comment.likeCount ?? 0;
  const name = comment.author?.displayName ?? "myHoodora user";
  return (
    <Pressable
      onLongPress={() => setMenu(true)}
      delayLongPress={350}
      accessibilityActions={[{ name: "longpress", label: "Comment options" }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && setMenu(true)}
      style={({ pressed }) => [styles.row, reply && styles.reply, pressed && { backgroundColor: tint(t.colors.foreground, 0.04) }]}
    >
      <Pressable onPress={() => openProfile(comment.authorUid)} accessibilityRole="link" accessibilityLabel={`${name}'s profile`} hitSlop={4}>
        <Avatar name={comment.author?.displayName} photoURL={comment.author?.photoURL} size={size} />
      </Pressable>
      <View style={styles.body}>
        <Text variant="caption" numberOfLines={1}>
          <Text variant="label" onPress={() => openProfile(comment.authorUid)} suppressHighlighting>
            {name}
          </Text>
          <Text variant="caption" tone="muted">{`  ${timeAgo(comment.createdAt)}`}</Text>
        </Text>
        <SeeMoreText id={comment._id} text={comment.content} lines={COMMENT_LINES} style={styles.text} />
        <View style={styles.actions}>
          <Pressable onPress={() => onReply(comment)} accessibilityRole="button" accessibilityLabel={`Reply to ${name}`} hitSlop={10}>
            <Text variant="label" tone="muted" style={styles.small}>
              Reply
            </Text>
          </Pressable>
          {likes > 0 ? (
            <View style={styles.likes} accessible accessibilityLabel={`${likes} ${likes === 1 ? "like" : "likes"}`}>
              <Text style={styles.emoji}>👍</Text>
              <Text variant="caption" tone="muted">
                {likes}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={() => onLike(comment)}
        accessibilityRole="button"
        accessibilityLabel={comment.liked ? "Unlike comment" : "Like comment"}
        accessibilityState={{ selected: !!comment.liked }}
        style={styles.like}
      >
        <ThumbsUp size={18} color={comment.liked ? t.colors.primary : t.colors.mutedForeground} fill={comment.liked ? tint(t.colors.primary, 0.25) : "transparent"} />
      </Pressable>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        label="Comment options"
        groups={[
          mine
            ? [{ key: "delete", label: "Delete comment", Icon: Trash2, destructive: true, onPress: remove }]
            : [{ key: "report", label: "Report comment", hint: "Private: they won't know it was you", Icon: Flag, onPress: () => setTimeout(() => setReporting(true), 350) }],
        ]}
      />
      {!mine ? <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={comment._id} /> : null}
    </Pressable>
  );
});

/** Your comment on its way ("Sending…"), or one that didn't go ("Couldn't send · Tap to retry"). */
export function PendingItem({ p, avatar, onRetry, onDiscard }: { p: PendingComment; avatar: { name?: string; photoURL?: string }; onRetry: () => void; onDiscard: () => void }) {
  const failed = p.status === "failed";
  return (
    <Pressable
      onPress={failed ? onRetry : undefined}
      onLongPress={failed ? onDiscard : undefined}
      disabled={!failed}
      accessibilityRole={failed ? "button" : undefined}
      accessibilityLabel={failed ? `Couldn't send: ${p.content}. Tap to retry` : `Sending: ${p.content}`}
      accessibilityHint={failed ? "Long press to discard" : undefined}
      style={[styles.row, p.parentId && styles.reply, !failed && styles.sending]}
    >
      <Avatar name={avatar.name} photoURL={avatar.photoURL} size={p.parentId ? 28 : 36} />
      <View style={styles.body}>
        <Text style={styles.text}>{p.content}</Text>
        <Text variant="caption" tone={failed ? "destructive" : "muted"}>
          {failed ? `Couldn't send${p.error ? `: ${p.error}` : ""} · Tap to retry` : "Sending…"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingLeft: 16, paddingRight: 4, paddingVertical: 8 },
  reply: { paddingLeft: 62 },
  sending: { opacity: 0.6 },
  body: { flex: 1, gap: 3 },
  text: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 24 },
  small: { fontSize: 13 },
  likes: { flexDirection: "row", alignItems: "center", gap: 4 },
  emoji: { fontSize: 13, lineHeight: 16 },
  like: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  gone: {},
  goneText: { flex: 1, fontStyle: "italic", alignSelf: "center" },
});
