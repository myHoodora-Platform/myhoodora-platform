import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Bell, BellOff, Bookmark, BookmarkMinus, Ellipsis, Flag, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { ActionSheet, type ActionItem } from "@/shared/ui/action-sheet";
import { useToast } from "@/shared/ui/toast";
import { deletePost, feedKeys } from "./feed-api";
import { ReportSheet } from "./report-sheet";
import { usePostActions } from "./use-post-actions";

/**
 * The "⋯" button and its menu, in groups: keep it (save, its notifications), then what's yours to do
 * (edit, delete) or to tell us about (report). Share lives in the action bar only.
 */
export function PostMenuButton({ post, onDeleted }: { post: ApiPost; onDeleted?: () => void }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const actions = usePostActions();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const mine = post.authorUid === user.uid;
  const remove = () =>
    Alert.alert("Delete your post?", "It will be removed for everyone, with its comments.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(user, post._id);
            client.setQueriesData<InfiniteData<ApiPost[]>>({ queryKey: feedKeys.all }, (data) => (data ? { ...data, pages: data.pages.map((page) => page.filter((p) => p._id !== post._id)) } : data));
            client.removeQueries({ queryKey: feedKeys.post(post._id) });
            toast("Post deleted.");
            onDeleted?.();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        },
      },
    ]);
  const saved = !!post.saved;
  const following = !!post.following;
  const groups: ActionItem[][] = [
    [
      saved
        ? { key: "unsave", label: "Unsave post", hint: "Remove it from your saved posts", Icon: BookmarkMinus, onPress: () => void actions.save(post, false) }
        : { key: "save", label: "Save post", hint: "Keep it in Saved posts on your profile", Icon: Bookmark, onPress: () => void actions.save(post, true) },
      following
        ? { key: "mute", label: "Turn off notifications for this post", Icon: BellOff, onPress: () => void actions.follow(post, false) }
        : { key: "follow", label: "Turn on notifications for this post", hint: "Hear about new comments", Icon: Bell, onPress: () => void actions.follow(post, true) },
    ],
    mine
      ? [
          { key: "edit", label: "Edit post", Icon: Pencil, onPress: () => router.push(`/p/${post._id}/edit`) },
          { key: "delete", label: "Delete post", Icon: Trash2, destructive: true, onPress: remove },
        ]
      : // After the menu has slid away, so the two sheets don't overlap.
        [{ key: "report", label: "Report post", hint: "Private: they won't know it was you", Icon: Flag, onPress: () => setTimeout(() => setReporting(true), 350) }],
  ];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Post options" hitSlop={8} style={({ pressed }) => [styles.iconAction, pressed && { backgroundColor: t.colors.muted }]}>
        <Ellipsis size={20} color={t.colors.mutedForeground} />
      </Pressable>
      <ActionSheet visible={open} onClose={() => setOpen(false)} groups={groups} label="Post options" />
      {!mine ? <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post._id} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  iconAction: { width: MIN_TOUCH - 4, height: MIN_TOUCH - 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
