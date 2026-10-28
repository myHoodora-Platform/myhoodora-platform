import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Conversation, Message } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { BellOff, ChevronRight, MoreVertical } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { usePhotoUploads } from "@/core/media/use-photo-uploads";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { ChatBubble, ChatComposer, DayLine, withDays, type BubbleFrame, type DayRows } from "@/shared/ui/chat";
import { MessageActions } from "@/shared/ui/message-actions";
import { IconButton } from "@/shared/ui/icon-button";
import { PhotoViewer } from "@/shared/ui/photo-viewer";
import { usePhotoPicking } from "@/shared/ui/photo-strip";
import { ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { sizedImage } from "@/shared/utils/media";
import { clock } from "@/shared/utils/time";
import { useLive } from "@/features/live/live-store";
import { useTypingIndicator, useTypingSignal } from "@/features/live/use-typing";
import { signal } from "@/features/feedback/engagement";
import { chatKeys, getConversation, isMuted, listMessages, otherPerson, sendMessage, sendTyping } from "./chat-api";
import { ConversationActions } from "./conversation-actions";
import { PinnedBar, PINNED_BAR_HEIGHT } from "./pinned-bar";
import { ReactionsSheet } from "./reactions-sheet";
import { bubbleReactions, useMessageActions } from "./use-message-actions";
import { ReportSheet } from "@/features/feed/report-sheet";
import { useToast } from "@/shared/ui/toast";

/** New messages arrive over the live connection; only while it's down does an open thread check (contract §19). */
const FALLBACK_POLL_MS = 15_000;
const MAX_PHOTOS = 4;

type Row = DayRows<{ message: Message; seen: boolean }>[number];

/** Messages with a day line wherever the day changes, and "Seen" under your last one they've read. */
function rowsFor(messages: Message[], me: string, theirLastRead?: string): Row[] {
  const lastMine = [...messages].reverse().find((m) => m.senderUid === me);
  const seenUpTo = theirLastRead ? new Date(theirLastRead).getTime() : 0;
  return withDays(
    messages.map((m) => ({ message: m, seen: m === lastMine && new Date(m.createdAt).getTime() <= seenUpTo })),
    (r) => r.message.createdAt,
    (r) => r.message._id,
  );
}

/** `/inbox/<id>`: one conversation. Opening it marks it read. */
export function ConversationScreen({ id }: { id: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const photos = usePhotoUploads("message", MAX_PHOTOS);
  const picking = usePhotoPicking(photos);
  const list = useRef<FlatList<Row>>(null);
  const convo = useQuery({ queryKey: chatKeys.one(id), queryFn: () => getConversation(user, id) });
  const live = useLive();
  const messages = useQuery({ queryKey: chatKeys.messages(id), queryFn: () => listMessages(user, id), refetchInterval: live.status === "live" ? false : FALLBACK_POLL_MS });
  const [reporting, setReporting] = useState(false);
  const participants = convo.data?.participants ?? [];
  const person = (uid: string) => {
    const p = participants.find((x) => x.uid === uid);
    return { name: p?.displayName ?? "Neighbour", photoURL: p?.photoURL };
  };
  const nameOf = (uid: string) => (uid === user.uid ? "You" : person(uid).name);
  const acts = useMessageActions({ conversationId: id, pins: convo.data?.pins, nameOf: (uid) => person(uid).name, onReport: () => setTimeout(() => setReporting(true), 300), onEdit: setText });
  const [reactionsOf, setReactionsOf] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: ({ body, urls }: { body: string; urls: string[] }) => sendMessage(user, id, body, urls, acts.replyingTo?._id),
    onSuccess: (message) => {
      setText("");
      photos.clear();
      acts.setReplyingTo(null);
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
  const ready = photos.urls.length > 0 && !photos.uploading && !photos.failed;
  const canSend = (body.length > 0 || ready) && !photos.uploading && !send.isPending;
  const submit = () => {
    if (acts.editing) {
      if (body) void acts.saveEdit(body).then((ok) => ok && setText(""));
      return;
    }
    if (canSend) send.mutate({ body, urls: photos.uploading ? [] : photos.urls });
  };

  const composer = (
    <ChatComposer
      text={text}
      onText={setText}
      placeholder="Write a message"
      uploads={photos}
      onAttach={picking.choose}
      onSend={submit}
      banner={acts.banner}
      sending={send.isPending}
      error={send.isError ? errorMessage(send.error) : null}
      above={
        <>
          {picking.note}
          {picking.sheet}
        </>
      }
    />
  );

  const muted = convo.data ? isMuted(convo.data) : false;
  return (
    <AppScreen
      fallback="/inbox"
      center={
        <Pressable onPress={() => other && router.push(`/u/${other.uid}`)} disabled={!other} accessibilityRole="link" accessibilityLabel={other ? `${other.displayName}'s profile` : undefined} style={styles.who}>
          <Avatar name={other?.displayName} photoURL={other?.photoURL} size={34} />
          <View style={styles.shrink}>
            <Text variant="label" numberOfLines={1}>
              {other?.displayName ?? "Message"}
            </Text>
            {otherTyping ? (
              <Text variant="caption" tone="primary" accessibilityLiveRegion="polite">
                typing…
              </Text>
            ) : muted ? (
              <View style={styles.inline}>
                <BellOff size={12} color={t.colors.mutedForeground} />
                <Text variant="caption" tone="muted">
                  Muted
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      }
      right={convo.data ? <IconButton Icon={MoreVertical} label="Chat options" onPress={() => setMenu(true)} /> : undefined}
      footer={composer}
    >
      <Thread
        convo={convo.data}
        me={user.uid}
        other={other?.displayName}
        messages={messages}
        list={list}
        quoteOf={acts.quoteOf}
        onHold={acts.hold}
        onReply={(m) => acts.setReplyingTo(m)}
        onReactions={(m) => setReactionsOf(m._id)}
        nameOf={nameOf}
        onUnpin={(messageId) => void acts.unpin(messageId)}
      />
      {acts.pinSheet}
      <MessageActions held={acts.held} actions={acts.actions} onReact={acts.reactToHeld} onClose={acts.close} />
      <ReactionsSheet
        message={messages.data?.find((m) => m._id === reactionsOf) ?? null}
        me={user.uid}
        person={person}
        onRemoveMine={() => {
          const m = messages.data?.find((x) => x._id === reactionsOf);
          if (m) void acts.react(m, null);
        }}
        onClose={() => setReactionsOf(null)}
      />
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="message" targetId={id} />
      {convo.data ? <ConversationActions convo={convo.data} visible={menu} onClose={() => setMenu(false)} inside onGone={() => (router.canGoBack() ? router.back() : router.replace("/inbox"))} /> : null}
    </AppScreen>
  );
}

/** The messages, oldest at the top, opening at the newest; the listing it's about pinned above. */
function Thread({
  convo,
  me,
  other,
  messages,
  list,
  quoteOf,
  onHold,
  onReply,
  onReactions,
  nameOf,
  onUnpin,
}: {
  convo?: Conversation;
  me: string;
  other?: string;
  messages: { data?: Message[]; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  list: React.RefObject<FlatList<Row> | null>;
  quoteOf: (q: NonNullable<Message["replyTo"]>) => { who: string; body: string; photo?: boolean; deleted?: boolean };
  onHold: (m: Message, frame: BubbleFrame) => void;
  onReply: (m: Message) => void;
  onReactions: (m: Message) => void;
  nameOf: (uid: string) => string;
  onUnpin: (messageId: string) => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const [viewing, setViewing] = useState<{ photos: string[]; start: number } | null>(null);
  const theirRead = convo?.readBy?.find((r) => r.uid !== me)?.lastReadAt;
  const rows = useMemo(() => rowsFor(messages.data ?? [], me, theirRead), [messages.data, me, theirRead]);
  const context = convo?.context;
  // Tapping a quote goes to the message it quotes, ringed for a moment.
  const [highlight, setHighlight] = useState<string | null>(null);
  const toast = useToast();
  const pins = convo?.pins ?? [];
  const barRoom = pins.length ? PINNED_BAR_HEIGHT : 0;
  const jumpTo = (messageId: string) => {
    const index = rows.findIndex((r) => r.kind === "item" && r.item.message._id === messageId);
    if (index < 0) return toast("That message is further back than this chat has loaded.");
    list.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
    setHighlight(messageId);
    setTimeout(() => setHighlight((h) => (h === messageId ? null : h)), 1600);
  };
  if (messages.isPending) return <LoadingState label="Loading messages" />;
  if (messages.isError && !messages.data) return <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />;
  return (
    <>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + barRoom + 12, paddingBottom: insets.bottom + 12 }]}
        scrollIndicatorInsets={{ top: insets.top + barRoom, bottom: insets.bottom }}
        keyboardDismissMode="interactive"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        // And when the room for it settles (the reply box measures itself after): open at the newest message.
        onLayout={() => list.current?.scrollToEnd({ animated: false })}
        // Rows aren't measured ahead: go near, then try again once they are.
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.4, animated: true }), 250);
        }}
        ListHeaderComponent={
          context ? (
            <Pressable onPress={() => router.push(`/for-sale/${context.id}`)} accessibilityRole="link" accessibilityLabel={`About ${context.title}, ${formatNaira(context.priceNaira)}. Opens the listing`} style={[styles.context, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              {context.photo ? <Image source={sizedImage(context.photo, 48)} style={styles.thumb} contentFit="cover" accessible={false} /> : null}
              <View style={styles.flex}>
                <Text variant="caption" tone="muted">
                  About
                </Text>
                <Text variant="label" numberOfLines={1}>
                  {context.title}
                </Text>
                <Text variant="caption" tone="primary">
                  {formatNaira(context.priceNaira)}
                </Text>
              </View>
              <ChevronRight size={18} color={t.colors.mutedForeground} />
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === "day") return <DayLine label={item.label} />;
          const m = item.item.message;
          const q = m.replyTo;
          return (
            <ChatBubble
              mine={m.senderUid === me}
              body={m.body}
              photos={m.photos}
              deleted={m.deleted}
              forwarded={m.forwardedManyTimes ? "many" : m.forwarded ? "once" : undefined}
              quote={q ? { ...quoteOf(q), onPress: q.deleted ? undefined : () => jumpTo(q._id) } : undefined}
              reactions={bubbleReactions(m, me)}
              highlighted={highlight === m._id}
              meta={`${pins.some((p) => p.messageId === m._id) ? "📌 " : ""}${clock(m.createdAt)}${m.editedAt && !m.deleted ? " · Edited" : ""}${item.item.seen ? " · Seen" : ""}`}
              onPhoto={(photos, start) => setViewing({ photos, start })}
              onLongPress={(frame) => onHold(m, frame)}
              onSwipeReply={() => onReply(m)}
              onReactions={() => onReactions(m)}
            />
          );
        }}
        ListEmptyComponent={
          <Text tone="muted" style={styles.empty}>
            Say hello to {other ?? "your neighbour"}.
          </Text>
        }
      />
      <PinnedBar pins={pins} top={insets.top} nameOf={nameOf} onJump={jumpTo} onUnpin={onUnpin} />
      {viewing ? <PhotoViewer photos={viewing.photos} start={viewing.start} visible onClose={() => setViewing(null)} label="Photo in the message" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  context: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
  who: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  shrink: { flexShrink: 1 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  list: { padding: 16, gap: 6, flexGrow: 1 },
  empty: { textAlign: "center", marginTop: 40 },
});
