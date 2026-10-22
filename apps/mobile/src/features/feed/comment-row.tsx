import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Comment } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Flag, Trash2 } from "lucide-react-native";
import { memo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { timeAgo } from "@/shared/utils/time";
import { isPending } from "./comment-composer";
import { deleteComment, feedKeys } from "./feed-api";
import { ReportSheet } from "./report-sheet";

/** One comment: who, when, what, and its "…" (delete your own, report someone else's). */
export const CommentRow = memo(function CommentRow({ comment, postId }: { comment: Comment; postId: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const pending = isPending(comment);
  const mine = comment.authorUid === user.uid;

  const remove = () =>
    Alert.alert("Delete your comment?", "It will be removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const before = client.getQueryData<Comment[]>(feedKeys.comments(postId));
          client.setQueryData<Comment[]>(feedKeys.comments(postId), (rows) => rows?.filter((c) => c._id !== comment._id));
          try {
            await deleteComment(user, comment._id);
            void client.invalidateQueries({ queryKey: feedKeys.post(postId), exact: true });
          } catch (err) {
            client.setQueryData(feedKeys.comments(postId), before);
            toast(errorMessage(err), "error");
          }
        },
      },
    ]);

  return (
    <View style={[styles.row, pending && styles.pending]} accessibilityLabel={pending ? `Sending: ${comment.content}` : undefined}>
      <Avatar name={comment.author?.displayName} photoURL={comment.author?.photoURL} size={36} />
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text variant="label" numberOfLines={1} style={styles.shrink}>
            {comment.author?.displayName ?? "A neighbour"}
          </Text>
          <Text variant="caption" tone="muted">
            · {pending ? "Sending…" : timeAgo(comment.createdAt)}
          </Text>
        </View>
        <Text style={styles.text}>{comment.content}</Text>
      </View>
      {!pending ? (
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Comment options" hitSlop={10} style={styles.more}>
          <Ellipsis size={18} color={t.colors.mutedForeground} />
        </Pressable>
      ) : null}
      <Sheet visible={menu} title="Comment" onClose={() => setMenu(false)}>
        {mine ? (
          <SheetItem
            label="Delete comment"
            destructive
            icon={<Trash2 size={20} color={t.colors.destructive} />}
            onPress={() => {
              setMenu(false);
              remove();
            }}
          />
        ) : (
          <SheetItem
            label="Report comment"
            icon={<Flag size={20} color={t.colors.foreground} />}
            onPress={() => {
              setMenu(false);
              setTimeout(() => setReporting(true), 400);
            }}
          />
        )}
      </Sheet>
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={comment._id} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: "flex-start" },
  pending: { opacity: 0.55 },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  shrink: { flexShrink: 1 },
  text: { fontSize: 15, lineHeight: 21 },
  more: { paddingTop: 2 },
});
