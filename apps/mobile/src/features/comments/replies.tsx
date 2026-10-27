import type { Comment } from "@myhoodora/api-contract/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys, listThread, nextOffset } from "@/features/feed/feed-api";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { CommentItem } from "./comment-item";

/**
 * A comment's replies, folded behind "View N replies" until asked for, then loaded a page at a time.
 * Opens by itself when you've just replied (`open`), so you see your reply land.
 */
export function Replies({ parent, postId, open: forced, onReply, onLike }: { parent: Comment; postId: string; open?: boolean; onReply: (c: Comment) => void; onLike: (c: Comment) => void }) {
  const t = useTheme();
  const user = useSignedInUser();
  const [opened, setOpened] = useState(false);
  const open = opened || !!forced;
  const replies = useInfiniteQuery({
    queryKey: feedKeys.replies(postId, parent._id),
    queryFn: ({ pageParam }) => listThread(user, postId, { parentId: parent._id, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled: open,
  });
  const count = parent.replyCount ?? 0;
  if (!count && !replies.data?.pages.flat().length) return null;
  const rows = replies.data?.pages.flat() ?? [];
  const left = Math.max(0, count - rows.length);

  return (
    <View>
      {open ? rows.map((r) => <CommentItem key={r._id} comment={r} postId={postId} reply onReply={onReply} onLike={onLike} />) : null}
      {open && replies.isFetching ? <ActivityIndicator style={styles.spinner} color={t.colors.primary} accessibilityLabel="Loading replies" /> : null}
      {!open || (left > 0 && replies.hasNextPage) ? (
        <Pressable
          onPress={() => (open ? void replies.fetchNextPage() : setOpened(true))}
          accessibilityRole="button"
          hitSlop={6}
          style={styles.toggle}
        >
          <ChevronDown size={16} color={t.colors.mutedForeground} />
          <Text variant="label" tone="muted" style={styles.small}>
            {open ? `View ${left} more ${left === 1 ? "reply" : "replies"}` : `View ${count} ${count === 1 ? "reply" : "replies"}`}
          </Text>
        </Pressable>
      ) : opened && !forced ? (
        <Pressable onPress={() => setOpened(false)} accessibilityRole="button" hitSlop={6} style={styles.toggle}>
          <ChevronUp size={16} color={t.colors.mutedForeground} />
          <Text variant="label" tone="muted" style={styles.small}>
            Hide replies
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 62, paddingVertical: 6, minHeight: 32 },
  small: { fontSize: 13 },
  spinner: { paddingVertical: 8 },
});
