import { errorMessage } from "@myhoodora/api-contract/errors";
import { SUPPORT_TOPICS, type SupportMessage, type SupportThreadSummary, type SupportTopic } from "@myhoodora/api-contract/support";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowUp, Pin } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useLive } from "@/features/live/live-store";
import { useTypingIndicator, useTypingSignal } from "@/features/live/use-typing";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Sheet } from "@/shared/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { contactSupport, getSupportThread, listSupportThreads, replyToSupport, sendSupportTyping, supportKeys, supportUnread } from "./support-api";

const STATUS_LABEL = { open: "Waiting for the team", waiting: "The team replied", resolved: "Resolved" } as const;
/** Only while the live connection is down (contract §19). */
const FALLBACK_POLL_MS = 15_000;

/** The team's avatar: the roof from our logo, so it's never mistaken for a neighbour. */
export function SupportAvatar({ size = 48 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.supportAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(t.colors.primary, 0.12) }]}>
      <Image source={require("../../../assets/brand/mascot-house.png")} style={{ width: size * 0.66, height: size * 0.44 }} contentFit="contain" accessible={false} />
    </View>
  );
}

export function useSupportUnread(): number {
  const user = useSignedInUser();
  return useQuery({ queryKey: supportKeys.unread, queryFn: () => supportUnread(user), staleTime: 30_000 }).data?.count ?? 0;
}

/**
 * Pinned at the top of Messages, above neighbours' conversations: the team is always one tap away,
 * and their questions about your requests land here (contract §18).
 */
export function SupportPinnedRow() {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const unread = useSupportUnread();
  const threads = useQuery({ queryKey: supportKeys.list, queryFn: () => listSupportThreads(user) });
  const latest = threads.data?.[0];
  const preview = latest?.lastMessage ? `${latest.lastMessage.from === "user" ? "You: " : ""}${latest.lastMessage.body}` : "Questions about your account or neighbourhood? We're here to help.";
  return (
    <Pressable
      onPress={() => router.push("/inbox/support")}
      accessibilityRole="button"
      accessibilityLabel={`myHoodora Support, pinned${unread ? `, ${unread} unread` : ""}. ${preview}`}
      style={({ pressed }) => [styles.pinned, { backgroundColor: pressed ? t.colors.muted : tint(t.colors.primary, unread ? 0.08 : 0.04), borderBottomColor: t.colors.border }]}
    >
      <SupportAvatar />
      <View style={styles.flex}>
        <View style={styles.line}>
          <Text variant="label" style={styles.flex}>
            myHoodora Support
          </Text>
          <Pin size={14} color={t.colors.mutedForeground} accessibilityLabel="Pinned" />
        </View>
        <Text variant="caption" tone={unread ? "default" : "muted"} numberOfLines={1} style={unread ? { fontFamily: t.fonts.semibold } : undefined}>
          {preview}
        </Text>
      </View>
      {unread ? (
        <View style={[styles.count, { backgroundColor: t.colors.primary }]}>
          <Text variant="caption" style={{ color: t.colors.primaryForeground }}>
            {unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── All support conversations ───────────────────────────────────────────────

/** `/inbox/support` */
export function SupportListScreen() {
  const [asking, setAsking] = useState(false);
  return (
    <AppScreen title="myHoodora Support" fallback="/inbox">
      <SupportList onAsk={() => setAsking(true)} />
      <NewSupportSheet visible={asking} onClose={() => setAsking(false)} />
    </AppScreen>
  );
}

function SupportList({ onAsk }: { onAsk: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const threads = useQuery({ queryKey: supportKeys.list, queryFn: () => listSupportThreads(user) });
  if (threads.isPending) return <LoadingState label="Loading your conversations with the team" />;
  if (!threads.data) return <ErrorState error={threads.error} onRetry={() => void threads.refetch()} />;
  return (
    <FlatList
      data={threads.data}
      keyExtractor={(th) => th.id}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
      ListHeaderComponent={
        <View style={styles.head}>
          <SupportAvatar size={64} />
          <Text tone="muted" style={styles.centred}>
            Our team usually replies within a day. You&apos;ll get a notification when they do.
          </Text>
          <Button label="Ask the team something" onPress={onAsk} />
        </View>
      }
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.colors.border }]} />}
      renderItem={({ item }) => <ThreadRow thread={item} onPress={() => router.push(`/inbox/support/${item.id}`)} />}
      ListEmptyComponent={<EmptyState title="No conversations yet" body="When you ask us something, or we have a question about one of your requests, it shows here." />}
    />
  );
}

function ThreadRow({ thread, onPress }: { thread: SupportThreadSummary; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : thread.unread ? tint(t.colors.primary, 0.05) : t.colors.background }]}>
      <View style={styles.flex}>
        <View style={styles.line}>
          <Text variant="label" numberOfLines={1} style={styles.flex}>
            {thread.subject}
          </Text>
          <Text variant="caption" tone="muted">
            {timeAgo(thread.updatedAt)}
          </Text>
        </View>
        <Text variant="caption" tone="primary">
          {STATUS_LABEL[thread.status]}
        </Text>
        {thread.lastMessage ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {`${thread.lastMessage.from === "user" ? "You: " : ""}${thread.lastMessage.body}`}
          </Text>
        ) : null}
      </View>
      {thread.unread ? <View style={[styles.dot, { backgroundColor: t.colors.primary }]} /> : null}
    </Pressable>
  );
}

/** "Ask the team something": what it's about, then the question. Opens the new conversation. */
function NewSupportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const client = useQueryClient();
  const [topic, setTopic] = useState<SupportTopic>("other");
  const [message, setMessage] = useState("");
  const start = useMutation({
    mutationFn: () => contactSupport(user, topic, message.trim()),
    onSuccess: ({ id }) => {
      setMessage("");
      onClose();
      void client.invalidateQueries({ queryKey: supportKeys.all });
      router.push(`/inbox/support/${id}`);
    },
  });
  const tooShort = message.trim().length < 10;
  return (
    <Sheet visible={visible} title="Ask the team" onClose={onClose}>
      <View style={styles.sheetBody}>
        <View style={styles.chips}>
          {SUPPORT_TOPICS.map((tp) => (
            <Chip key={tp.id} label={tp.label} selected={topic === tp.id} onPress={() => setTopic(tp.id)} />
          ))}
        </View>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="How can we help?"
          placeholderTextColor={t.colors.mutedForeground}
          multiline
          maxLength={2000}
          accessibilityLabel="Your question"
          style={[styles.question, { color: t.colors.foreground, backgroundColor: t.colors.muted, fontFamily: t.fonts.regular }]}
        />
        {start.isError ? <InlineAlert>{errorMessage(start.error)}</InlineAlert> : null}
        <Button label="Send" onPress={() => start.mutate()} loading={start.isPending} disabled={tooShort} />
      </View>
    </Sheet>
  );
}

// ── One conversation ────────────────────────────────────────────────────────

/** `/inbox/support/<id>` */
export function SupportThreadScreen({ id }: { id: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const client = useQueryClient();
  const live = useLive();
  const list = useRef<FlatList<SupportMessage>>(null);
  const [text, setText] = useState("");
  const thread = useQuery({ queryKey: supportKeys.one(id), queryFn: () => getSupportThread(user, id), refetchInterval: live.status === "live" ? false : FALLBACK_POLL_MS });
  const send = useMutation({
    mutationFn: (body: string) => replyToSupport(user, id, body),
    onSuccess: (fresh) => {
      setText("");
      client.setQueryData(supportKeys.one(id), fresh);
      void client.invalidateQueries({ queryKey: supportKeys.list });
    },
  });
  // As on the web: the team sees you typing, and you see them.
  useTypingSignal(text, () => sendSupportTyping(user, id));
  const teamTyping = useTypingIndicator("support.typing", ["support.message"], (e) => e.threadId === id);
  const body = text.trim();
  const canSend = body.length > 0 && !send.isPending;

  const composer = (
    <GlassSurface style={[styles.composer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {send.isError ? <InlineAlert>{`Not sent: ${errorMessage(send.error)}`}</InlineAlert> : null}
      <View style={[styles.input, { backgroundColor: t.colors.muted }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Reply to the team"
          placeholderTextColor={t.colors.mutedForeground}
          multiline
          maxLength={2000}
          accessibilityLabel="Reply to the team"
          style={[styles.inputText, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
        />
        {canSend ? (
          <Pressable onPress={() => send.mutate(body)} accessibilityRole="button" accessibilityLabel="Send" style={[styles.send, { backgroundColor: t.colors.primary }]}>
            {send.isPending ? <ActivityIndicator size="small" color={t.colors.primaryForeground} /> : <ArrowUp size={18} color={t.colors.primaryForeground} />}
          </Pressable>
        ) : null}
      </View>
    </GlassSurface>
  );

  return (
    <AppScreen
      fallback="/inbox/support"
      center={
        <View style={styles.who}>
          <SupportAvatar size={32} />
          <View style={styles.shrink}>
            <Text variant="label" numberOfLines={1}>
              {thread.data?.subject ?? "myHoodora Support"}
            </Text>
            {teamTyping ? (
              <Text variant="caption" tone="primary" accessibilityLiveRegion="polite">
                The team is typing…
              </Text>
            ) : thread.data ? (
              <Text variant="caption" tone="muted">
                {STATUS_LABEL[thread.data.status]}
              </Text>
            ) : null}
          </View>
        </View>
      }
      footer={composer}
    >
      <SupportMessages messages={thread.data?.messages} state={thread} list={list} />
    </AppScreen>
  );
}

function SupportMessages({ messages, state, list }: { messages?: SupportMessage[]; state: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; list: React.RefObject<FlatList<SupportMessage> | null> }) {
  const t = useTheme();
  const insets = useScreenInsets();
  if (state.isPending) return <LoadingState label="Loading the conversation" />;
  if (state.isError && !messages) return <ErrorState error={state.error} onRetry={() => void state.refetch()} title="This conversation isn't available" />;
  return (
    <FlatList
      ref={list}
      data={messages}
      keyExtractor={(m, i) => `${m.at}-${i}`}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
      keyboardDismissMode="interactive"
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      renderItem={({ item }) => {
        const mine = item.from === "user";
        return (
          <View style={[styles.bubbleRow, mine && styles.mine]}>
            {!mine ? (
              <Text variant="caption" tone="primary">
                {item.by ? `${item.by} · myHoodora team` : "myHoodora team"}
              </Text>
            ) : null}
            <View style={[styles.bubble, { backgroundColor: mine ? t.colors.primary : t.colors.card }, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={{ color: mine ? t.colors.primaryForeground : t.colors.foreground }}>{item.body}</Text>
            </View>
            <Text variant="caption" tone="muted" style={styles.time}>
              {timeAgo(item.at)}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  supportAvatar: { alignItems: "center", justifyContent: "center" },
  pinned: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  head: { alignItems: "center", gap: 12, padding: 20 },
  centred: { textAlign: "center" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: MIN_TOUCH + 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheetBody: { paddingHorizontal: 12, gap: 12, paddingBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  question: { minHeight: 110, borderRadius: 16, padding: 14, fontSize: 16, textAlignVertical: "top" },
  who: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  composer: { paddingHorizontal: 12, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flexDirection: "row", alignItems: "flex-end", borderRadius: 22, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, minHeight: MIN_TOUCH - 4 },
  inputText: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, gap: 10, flexGrow: 1 },
  bubbleRow: { alignItems: "flex-start", gap: 3, maxWidth: "82%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  time: { fontSize: 11 },
});
