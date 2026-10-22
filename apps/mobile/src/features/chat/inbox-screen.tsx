import type { Conversation } from "@myhoodora/api-contract/types";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { timeAgo } from "@/shared/utils/time";
import { SupportPinnedRow } from "@/features/support/support-screens";
import { chatKeys, listConversations } from "./chat-api";

/** The other person in a thread. */
export function otherPerson(c: Conversation, me: string) {
  return c.participants?.find((p) => p.uid !== me);
}

function Row({ c, me }: { c: Conversation; me: string }) {
  const t = useTheme();
  const router = useRouter();
  const other = otherPerson(c, me);
  const unread = c.unreadCount > 0;
  const last = c.lastMessage ? `${c.lastMessage.senderUid === me ? "You: " : ""}${c.lastMessage.body}` : "No messages yet";
  return (
    <Pressable
      onPress={() => router.push(`/inbox/${c._id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread. " : ""}${other?.displayName ?? "A neighbour"}${c.context ? `, about ${c.context.title}` : ""}. ${last}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : unread ? tint(t.colors.primary, 0.05) : t.colors.background }]}
    >
      <Avatar name={other?.displayName} photoURL={other?.photoURL} size={48} />
      <View style={styles.flex}>
        <View style={styles.line}>
          <Text variant="label" style={styles.flex} numberOfLines={1}>
            {other?.displayName ?? "A neighbour"}
          </Text>
          <Text variant="caption" tone="muted">
            {timeAgo(c.lastMessage?.createdAt ?? c.updatedAt)}
          </Text>
        </View>
        {c.context ? (
          <Text variant="caption" tone="primary" numberOfLines={1}>
            {c.context.title} · {formatNaira(c.context.priceNaira)}
          </Text>
        ) : null}
        <Text variant="caption" tone={unread ? "default" : "muted"} numberOfLines={1} style={unread && { fontFamily: t.fonts.semibold }}>
          {last}
        </Text>
      </View>
      {c.context?.photo ? <Image source={c.context.photo} style={styles.thumb} contentFit="cover" accessible={false} /> : unread ? <View style={[styles.dot, { backgroundColor: t.colors.primary }]} /> : null}
    </Pressable>
  );
}

/** `/inbox`: conversations with neighbours, newest first (the web's Inbox). */
export function InboxScreen() {
  return (
    <AppScreen title="Messages" canvas={false}>
      <InboxList />
    </AppScreen>
  );
}

function InboxList() {
  const insets = useScreenInsets();
  const t = useTheme();
  const user = useSignedInUser();
  const list = useQuery({ queryKey: chatKeys.all, queryFn: () => listConversations(user) });
  const pull = usePullRefresh(list.refetch);

  if (list.isPending) {
    return (
      <View style={[styles.skeleton, { paddingTop: insets.top + 16 }]} accessible accessibilityLabel="Loading messages">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.line}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={[styles.flex, { gap: 6 }]}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="80%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  // A failed background refresh keeps the conversations already shown.
  if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={[styles.grow, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      data={list.data}
      keyExtractor={(c) => c._id}
      renderItem={({ item }) => <Row c={item} me={user.uid} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.colors.border }]} />}
      ListHeaderComponent={<SupportPinnedRow />}
      ListEmptyComponent={<EmptyState title="No messages from neighbours yet" body="Message a seller from For Sale & Free, or a neighbour from their profile, and your conversations will show here." />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: MIN_TOUCH + 24 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  skeleton: { padding: 16, gap: 20 },
});
