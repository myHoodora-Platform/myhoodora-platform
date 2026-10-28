import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Message } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "@/core/navigation/use-router";
import { ArrowUp } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { timeAgo } from "@/shared/utils/time";
import { useLive } from "@/features/live/live-store";
import { useTypingIndicator, useTypingSignal } from "@/features/live/use-typing";
import { chatKeys, getConversation, listMessages, sendMessage, sendTyping } from "./chat-api";
import { otherPerson } from "./inbox-screen";
import { signal } from "@/features/feedback/engagement";

/** New messages arrive over the live connection; only while it's down does an open thread check (contract §19). */
const FALLBACK_POLL_MS = 15_000;

/** `/inbox/<id>`: one conversation. Opening it marks it read. */
export function ConversationScreen({ id }: { id: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const list = useRef<FlatList<Message>>(null);
  const convo = useQuery({ queryKey: chatKeys.one(id), queryFn: () => getConversation(user, id) });
  const live = useLive();
  const messages = useQuery({ queryKey: chatKeys.messages(id), queryFn: () => listMessages(user, id), refetchInterval: live.status === "live" ? false : FALLBACK_POLL_MS });
  const send = useMutation({
    mutationFn: (body: string) => sendMessage(user, id, body),
    onSuccess: (message) => {
      setText("");
      signal(user, "message_sent", id);
      client.setQueryData<Message[]>(chatKeys.messages(id), (rows) => [...(rows ?? []), message]);
      void client.invalidateQueries({ queryKey: chatKeys.all });
    },
  });

  // Reading the thread marks it read: the inbox and the badge should say so.
  const count = messages.data?.length ?? 0;
  useEffect(() => {
    if (count) void client.invalidateQueries({ queryKey: chatKeys.unread });
  }, [count, client]);

  // "typing…" both ways, as on the web: their signal shows under the name; ours goes while we write.
  useTypingSignal(text, () => sendTyping(user, id));
  const otherTyping = useTypingIndicator("chat.typing", ["chat.message"], (e) => e.conversationId === id);

  const other = convo.data ? otherPerson(convo.data, user.uid) : undefined;
  const body = text.trim();
  const canSend = body.length > 0 && !send.isPending;

  const composer = (
    <GlassSurface style={[styles.composer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {send.isError ? <InlineAlert>{`Not sent: ${errorMessage(send.error)}`}</InlineAlert> : null}
      <View style={[styles.input, { backgroundColor: t.colors.muted }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message"
          placeholderTextColor={t.colors.mutedForeground}
          multiline
          maxLength={2000}
          accessibilityLabel="Write a message"
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
      fallback="/inbox"
      center={
        <View style={styles.who}>
          <Avatar name={other?.displayName} photoURL={other?.photoURL} size={32} />
          <View style={styles.shrink}>
            <Text variant="label" numberOfLines={1}>
              {other?.displayName ?? "Message"}
            </Text>
            {otherTyping ? (
              <Text variant="caption" tone="primary" accessibilityLiveRegion="polite">
                typing…
              </Text>
            ) : null}
          </View>
        </View>
      }
      footer={composer}
    >
      <Thread id={id} me={user.uid} context={convo.data?.context} other={other?.displayName} messages={messages} list={list} />
    </AppScreen>
  );
}

/** The messages, oldest at the top, opening at the newest; the listing it's about pinned above. */
function Thread({
  me,
  context,
  other,
  messages,
  list,
}: {
  id: string;
  me: string;
  context?: { id: string; title: string; photo?: string; priceNaira: number | null };
  other?: string;
  messages: { data?: Message[]; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  list: React.RefObject<FlatList<Message> | null>;
}) {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  if (messages.isPending) return <LoadingState label="Loading messages" />;
  if (messages.isError && !messages.data) return <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />;
  return (
    <FlatList
      ref={list}
      data={messages.data}
      keyExtractor={(m) => m._id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
      scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
      keyboardDismissMode="interactive"
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      ListHeaderComponent={
        context ? (
          <Pressable onPress={() => router.push(`/for-sale/${context.id}`)} accessibilityRole="link" style={[styles.context, { backgroundColor: t.colors.card }]}>
            {context.photo ? <Image source={context.photo} style={styles.thumb} contentFit="cover" accessible={false} /> : null}
            <View style={styles.flex}>
              <Text variant="label" numberOfLines={1}>
                {context.title}
              </Text>
              <Text variant="caption" tone="muted">
                {formatNaira(context.priceNaira)}
              </Text>
            </View>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => {
        const mine = item.senderUid === me;
        return (
          <View style={[styles.bubbleRow, mine && styles.mine]}>
            <View style={[styles.bubble, { backgroundColor: mine ? t.colors.primary : t.colors.card }, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={{ color: mine ? t.colors.primaryForeground : t.colors.foreground }}>{item.body}</Text>
            </View>
            <Text variant="caption" tone="muted" style={styles.time}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
        );
      }}
      ListEmptyComponent={<Text tone="muted" style={styles.empty}>Say hello to {other ?? "your neighbour"}.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  context: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, marginBottom: 6 },
  who: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  shrink: { flexShrink: 1 },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  bubbleRow: { alignItems: "flex-start", gap: 2, maxWidth: "80%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  time: { fontSize: 11 },
  empty: { textAlign: "center", marginTop: 40 },
  composer: { paddingHorizontal: 12, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flexDirection: "row", alignItems: "flex-end", borderRadius: 22, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, minHeight: MIN_TOUCH - 4 },
  inputText: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
