import type { Conversation } from "@myhoodora/api-contract/types";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { BellOff, Pin, Search, SquarePen, Users, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Chip } from "@/shared/ui/chip";
import { IconButton } from "@/shared/ui/icon-button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { timeAgo } from "@/shared/utils/time";
import { SupportPinnedRow } from "@/features/support/support-screens";
import { useFeatureSignal } from "@/features/feedback/use-feature-signal";
import { aboutListing, chatKeys, isGroupChat, isMuted, listConversations, listRequests, otherPerson } from "./chat-api";
import { useMessageRequests } from "./use-unread-messages";
import { ConversationActions } from "./conversation-actions";
import { loadDrafts, useDrafts } from "./drafts";

export { otherPerson } from "./chat-api";

type Filter = "all" | "unread" | "listings" | "requests" | "archived";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "listings", label: "Buying & selling" },
  { id: "requests", label: "Requests" },
  { id: "archived", label: "Archived" },
];

/** Matches the person's name, the listing it's about, or the last message. */
function matches(c: Conversation, me: string, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [isGroupChat(c) ? c.title : otherPerson(c, me)?.displayName, c.context?.title, c.lastMessage?.body].some((s) => s?.toLowerCase().includes(needle));
}

function Row({ c, me, draft }: { c: Conversation; me: string; draft?: string }) {
  const t = useTheme();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const other = otherPerson(c, me);
  const group = isGroupChat(c);
  const name = group ? (c.title ?? "Group") : (other?.displayName ?? "A neighbour");
  const unread = c.unreadCount > 0;
  const muted = isMuted(c);
  // In a group, who said it ("Ada: …"); a notice ("Ada added Bola") as it is.
  const sender = c.lastMessage && !c.lastMessage.system ? (c.lastMessage.senderUid === me ? "You: " : group ? `${(c.participants?.find((p) => p.uid === c.lastMessage!.senderUid)?.displayName ?? "Someone").split(" ")[0]}: ` : "") : "";
  const last = c.lastMessage ? `${sender}${c.lastMessage.body}` : "No messages yet";
  const draftLine = draft?.replace(/\s+/g, " ").trim();
  return (
    <>
      <Pressable
        onPress={() => router.push(`/inbox/${c._id}`)}
        onLongPress={() => setMenu(true)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${c.pinned ? "Pinned. " : ""}${unread ? "Unread. " : ""}${c.request ? "Message request. " : ""}${group ? `Group ${name}` : name}${c.context ? `, about ${c.context.title}` : ""}${muted ? ", muted" : ""}. ${draftLine ? `Draft: ${draftLine}` : last}`}
        accessibilityHint="Hold for options"
        accessibilityActions={[{ name: "longpress", label: "Options" }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && setMenu(true)}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : unread ? tint(t.colors.primary, 0.05) : t.colors.background }]}
      >
        {group ? (
          <View style={[styles.groupAvatar, { backgroundColor: tint(t.colors.primary, 0.1) }]}>
            <Users size={24} color={t.colors.primary} />
          </View>
        ) : (
          <Avatar name={other?.displayName} photoURL={other?.photoURL} size={52} />
        )}
        <View style={styles.flex}>
          <View style={styles.line}>
            <Text variant="label" style={[styles.flex, unread && { fontFamily: t.fonts.bold }]} numberOfLines={1}>
              {name}
            </Text>
            {muted ? <BellOff size={14} color={t.colors.mutedForeground} accessibilityLabel="Muted" /> : null}
            {c.pinned ? <Pin size={14} color={t.colors.mutedForeground} accessibilityLabel="Pinned" /> : null}
            <Text variant="caption" tone={unread ? "primary" : "muted"}>
              {timeAgo(c.lastMessage?.createdAt ?? c.updatedAt)}
            </Text>
          </View>
          {c.context ? (
            <Text variant="caption" tone="primary" numberOfLines={1}>
              {c.context.title} · {formatNaira(c.context.priceNaira)}
            </Text>
          ) : null}
          <View style={styles.line}>
            {draftLine ? (
              // WhatsApp's way: what you'd started writing, until it's sent.
              <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                <Text variant="caption" tone="primary" style={{ fontFamily: t.fonts.semibold }}>
                  Draft:{" "}
                </Text>
                {draftLine}
              </Text>
            ) : (
              <Text variant="caption" tone={unread ? "default" : "muted"} numberOfLines={1} style={[styles.flex, unread && { fontFamily: t.fonts.semibold }]}>
                {last}
              </Text>
            )}
            {unread ? (
              <View style={[styles.count, { backgroundColor: muted ? t.colors.mutedForeground : t.colors.primary }]}>
                <Text style={[styles.countText, { color: t.colors.primaryForeground, fontFamily: t.fonts.bold }]}>{c.unreadCount > 9 ? "9+" : c.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {c.context?.photo ? <Image source={c.context.photo} style={styles.thumb} contentFit="cover" accessible={false} /> : null}
      </Pressable>
      <ConversationActions convo={c} visible={menu} onClose={() => setMenu(false)} />
    </>
  );
}

/**
 * `/inbox` (Messages, one tap from every tab): search, filters (All, Unread, Buying & selling,
 * Archived), the team pinned on top, then your pinned chats, and a new message to any neighbour.
 * Hold a chat to pin, archive, mute or delete it.
 */
export function InboxScreen() {
  useFeatureSignal("messages");
  const router = useRouter();
  return (
    <AppScreen title="Messages" canvas={false} right={<IconButton Icon={SquarePen} label="New message" onPress={() => router.push("/inbox/new")} />}>
      <InboxList />
    </AppScreen>
  );
}

function InboxList() {
  const insets = useScreenInsets();
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const archived = filter === "archived";
  const requests = filter === "requests";
  const list = useQuery({ queryKey: requests ? chatKeys.requests : chatKeys.list(archived), queryFn: () => (requests ? listRequests(user) : listConversations(user, archived)) });
  const waiting = useMessageRequests();
  const drafts = useDrafts(user.uid);
  useEffect(() => {
    void loadDrafts(user.uid);
  }, [user.uid]);
  const pull = usePullRefresh(list.refetch);
  const q = text.trim();
  const rows = useMemo(
    () => (list.data ?? []).filter((c) => (filter === "unread" ? c.unreadCount > 0 : filter === "listings" ? aboutListing(c) : true) && matches(c, user.uid, q)),
    [list.data, filter, q, user.uid],
  );
  const unreadCount = (filter === "archived" || requests ? [] : (list.data ?? [])).filter((c) => c.unreadCount > 0).length;
  // Requests shows only while there are some (or it's the one chosen).
  const filters = FILTERS.filter((f) => f.id !== "requests" || waiting > 0 || requests);

  const header = (
    <View style={styles.header}>
      <View style={[styles.search, { backgroundColor: t.colors.muted }]}>
        <Search size={18} color={t.colors.mutedForeground} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search messages"
          placeholderTextColor={t.colors.mutedForeground}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search messages"
          style={[styles.searchInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
        />
        {text ? (
          <Pressable onPress={() => setText("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
            <X size={18} color={t.colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow} accessibilityLabel="Show">
        {filters.map((f) => (
          <Chip key={f.id} label={f.id === "unread" && unreadCount ? `Unread (${unreadCount})` : f.id === "requests" && waiting ? `Requests (${waiting})` : f.label} selected={f.id === filter} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>
      {filter === "all" && !q ? <SupportPinnedRow /> : null}
    </View>
  );

  const empty =
    q ? (
      <EmptyState title={`Nothing for “${q}”`} body="Search looks through names, listings and the last message of each chat." />
    ) : filter === "unread" ? (
      <EmptyState title="You're all caught up" body="No unread messages." />
    ) : filter === "listings" ? (
      <EmptyState title="No chats about listings yet" body="Message a seller from For Sale & Free and the chat shows here." action={{ label: "Browse For Sale", onPress: () => router.push("/for-sale") }} />
    ) : requests ? (
      <EmptyState title="No message requests" body="When someone you haven't written to messages you, it waits here until you accept. They don't know you've read it until then." />
    ) : archived ? (
      <EmptyState title="Nothing archived" body="Hold a chat in Messages and choose Archive to tidy it away. A new message brings it back." />
    ) : (
      <EmptyState title="No messages from neighbours yet" body="Start a chat with a neighbour, or message a seller from For Sale & Free." action={{ label: "New message", onPress: () => router.push("/inbox/new") }} />
    );

  return (
    <FlatList
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={[styles.grow, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={list.data ? rows : []}
      keyExtractor={(c) => c._id}
      renderItem={({ item }) => <Row c={item} me={user.uid} draft={drafts[item._id]} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.colors.border }]} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.skeleton} accessible accessibilityLabel="Loading messages">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.line}>
                <Skeleton width={52} height={52} radius={26} />
                <View style={[styles.flex, { gap: 6 }]}>
                  <Skeleton width="40%" height={14} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          empty
        )
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: { paddingTop: 12, gap: 12, paddingBottom: 4 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 14, borderRadius: 999, minHeight: MIN_TOUCH - 4 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  chipRow: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: MIN_TOUCH + 24 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  groupAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 11, lineHeight: 13 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
  skeleton: { padding: 16, gap: 20 },
});
