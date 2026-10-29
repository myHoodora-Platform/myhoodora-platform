import type { ApiPost } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { cachedPost, feedKeys, getPost } from "@/features/feed/feed-api";
import { reactionDef, topReactions } from "@/features/feed/reactions";
import { useTheme } from "@/shared/theme/theme";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { Text } from "@/shared/ui/text";
import { ThreadComposer } from "./thread-composer";
import { loadMore, ThreadEmpty, ThreadHead, ThreadMore, useThread } from "./use-thread";

/** "👍😂 536" or "Be the first to like this", and "12 comments", with a close button. */
function SheetHeader({ post, onClose }: { post?: ApiPost; onClose: () => void }) {
  const t = useTheme();
  const total = post?.reactionTotal ?? 0;
  const comments = post?.commentCount ?? 0;
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        {total ? (
          <View style={styles.faces} accessible accessibilityLabel={`${total} ${total === 1 ? "reaction" : "reactions"}`}>
            {topReactions(post?.reactionCounts).map((id) => (
              <Text key={id} style={styles.face}>
                {reactionDef(id).emoji}
              </Text>
            ))}
            <Text variant="label">{total}</Text>
          </View>
        ) : (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Be the first to react to this
          </Text>
        )}
        <View style={styles.flex} />
        {comments ? (
          <Text variant="caption" tone="muted">
            {comments} {comments === 1 ? "comment" : "comments"}
          </Text>
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments" hitSlop={10} style={styles.close}>
          <X size={20} color={t.colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * `/p/<id>/comments`: the conversation in a sheet over the feed (opens at 60% of the screen, drag
 * the top up to 95%; closes by dragging down, the backdrop, the X or Android back), fitted to a short
 * thread. The thread itself is `useThread`, shared with the post's page.
 */
export function CommentsSheet({ id }: { id: string }) {
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const input = useRef<TextInput>(null);
  const thread = useThread(id, input);
  // The thread's height once loaded, so the sheet fits a short one (BottomSheet).
  const [listHeight, setListHeight] = useState<number | undefined>(undefined);
  const post = useQuery({ queryKey: feedKeys.post(id), queryFn: () => getPost(user, id), placeholderData: () => cachedPost(client, id) });

  return (
    <BottomSheet
      label="Comments"
      onClose={() => router.back()}
      contentHeight={thread.thread.isPending ? undefined : listHeight}
      header={(close) => <SheetHeader post={post.data} onClose={close} />}
      footer={post.data ? <ThreadComposer ref={input} post={post.data} replyTo={thread.replyTo} onCancelReply={() => thread.setReplyTo(undefined)} send={thread.send} /> : undefined}
    >
      <FlatList
        style={styles.flex}
        data={thread.roots}
        keyExtractor={(c) => c._id}
        renderItem={thread.renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<ThreadHead thread={thread} />}
        ListEmptyComponent={<ThreadEmpty thread={thread} />}
        ListFooterComponent={<ThreadMore thread={thread} />}
        onEndReached={() => loadMore(thread)}
        onEndReachedThreshold={0.4}
        onContentSizeChange={(_w, h) => setListHeight(h)}
        contentContainerStyle={styles.list}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 16 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  faces: { flexDirection: "row", alignItems: "center", gap: 2 },
  face: { fontSize: 16, lineHeight: 20 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 12 },
});
