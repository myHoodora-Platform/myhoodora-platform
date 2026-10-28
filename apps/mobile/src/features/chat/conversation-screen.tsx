import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Conversation, Message } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ArrowUp, BellOff, ChevronRight, ImagePlus, MoreVertical, RotateCcw, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { usePhotoUploads, type PhotoUploads } from "@/core/media/use-photo-uploads";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { IconButton } from "@/shared/ui/icon-button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { PhotoViewer } from "@/shared/ui/photo-viewer";
import { usePhotoPicking } from "@/shared/ui/photo-strip";
import { ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { sizedImage } from "@/shared/utils/media";
import { clock, dayLabel } from "@/shared/utils/time";
import { useLive } from "@/features/live/live-store";
import { useTypingIndicator, useTypingSignal } from "@/features/live/use-typing";
import { signal } from "@/features/feedback/engagement";
import { chatKeys, getConversation, isMuted, listMessages, otherPerson, sendMessage, sendTyping } from "./chat-api";
import { ConversationActions } from "./conversation-actions";

/** New messages arrive over the live connection; only while it's down does an open thread check (contract §19). */
const FALLBACK_POLL_MS = 15_000;
const MAX_PHOTOS = 4;

type Row = { kind: "day"; key: string; label: string } | { kind: "message"; key: string; message: Message; seen: boolean };

/** Messages with a day line wherever the day changes, and "Seen" under your last one they've read. */
function rowsFor(messages: Message[], me: string, theirLastRead?: string): Row[] {
  const rows: Row[] = [];
  const lastMine = [...messages].reverse().find((m) => m.senderUid === me);
  const seenUpTo = theirLastRead ? new Date(theirLastRead).getTime() : 0;
  messages.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (i === 0 || dayLabel(messages[i - 1]!.createdAt) !== day) rows.push({ kind: "day", key: `day-${m._id}`, label: day });
    rows.push({ kind: "message", key: m._id, message: m, seen: m === lastMine && new Date(m.createdAt).getTime() <= seenUpTo });
  });
  return rows;
}

/** `/inbox/<id>`: one conversation. Opening it marks it read. */
export function ConversationScreen({ id }: { id: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
  const send = useMutation({
    mutationFn: ({ body, urls }: { body: string; urls: string[] }) => sendMessage(user, id, body, urls),
    onSuccess: (message) => {
      setText("");
      photos.clear();
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
  const submit = () => canSend && send.mutate({ body, urls: photos.uploading ? [] : photos.urls });

  const composer = (
    <GlassSurface style={[styles.composer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {send.isError ? <InlineAlert>{`Not sent: ${errorMessage(send.error)}`}</InlineAlert> : null}
      {picking.note}
      {photos.items.length ? <Tray uploads={photos} /> : null}
      <View style={styles.composerRow}>
        {photos.room > 0 ? <IconButton Icon={ImagePlus} label="Add photos" onPress={picking.choose} /> : null}
        <View style={[styles.input, { backgroundColor: t.colors.muted }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={photos.items.length ? "Add a message (optional)" : "Write a message"}
            placeholderTextColor={t.colors.mutedForeground}
            multiline
            maxLength={2000}
            accessibilityLabel="Write a message"
            style={[styles.inputText, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {canSend || send.isPending ? (
            <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Send" style={[styles.send, { backgroundColor: t.colors.primary }]}>
              {send.isPending ? <ActivityIndicator size="small" color={t.colors.primaryForeground} /> : <ArrowUp size={18} color={t.colors.primaryForeground} />}
            </Pressable>
          ) : null}
        </View>
      </View>
      {picking.sheet}
    </GlassSurface>
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
      <Thread convo={convo.data} me={user.uid} other={other?.displayName} messages={messages} list={list} />
      {convo.data ? <ConversationActions convo={convo.data} visible={menu} onClose={() => setMenu(false)} inside onGone={() => (router.canGoBack() ? router.back() : router.replace("/inbox"))} /> : null}
    </AppScreen>
  );
}

/** The photos about to go, each with its upload state; tap ✕ to leave one out. */
function Tray({ uploads }: { uploads: PhotoUploads }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
      {uploads.items.map((p, i) => (
        <View key={p.key} style={[styles.trayTile, { backgroundColor: t.colors.muted }]}>
          <Image source={p.uri} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}${p.status === "uploading" ? ", uploading" : p.status === "failed" ? ", didn't upload" : ""}`} />
          {p.status === "uploading" ? (
            <View style={styles.trayCover}>
              <ActivityIndicator color="#ffffff" size="small" />
            </View>
          ) : null}
          {p.status === "failed" ? (
            <Pressable onPress={() => uploads.retry(p.key)} accessibilityRole="button" accessibilityLabel={`Retry photo ${i + 1}`} style={[styles.trayCover, styles.trayFailed]}>
              <RotateCcw size={18} color="#ffffff" />
            </Pressable>
          ) : null}
          <Pressable onPress={() => uploads.remove(p.key)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={8} style={styles.trayRemove}>
            <X size={12} color="#ffffff" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/** The messages, oldest at the top, opening at the newest; the listing it's about pinned above. */
function Thread({
  convo,
  me,
  other,
  messages,
  list,
}: {
  convo?: Conversation;
  me: string;
  other?: string;
  messages: { data?: Message[]; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  list: React.RefObject<FlatList<Row> | null>;
}) {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const [viewing, setViewing] = useState<{ photos: string[]; start: number } | null>(null);
  const theirRead = convo?.readBy?.find((r) => r.uid !== me)?.lastReadAt;
  const rows = useMemo(() => rowsFor(messages.data ?? [], me, theirRead), [messages.data, me, theirRead]);
  const context = convo?.context;
  if (messages.isPending) return <LoadingState label="Loading messages" />;
  if (messages.isError && !messages.data) return <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />;
  return (
    <>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
        scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
        keyboardDismissMode="interactive"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
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
          if (item.kind === "day") {
            return (
              <Text variant="caption" tone="muted" style={styles.day} accessibilityRole="header">
                {item.label}
              </Text>
            );
          }
          const m = item.message;
          const mine = m.senderUid === me;
          const fg = mine ? t.colors.primaryForeground : t.colors.foreground;
          return (
            <View style={[styles.bubbleRow, mine && styles.mine]}>
              <View style={[styles.bubble, { backgroundColor: mine ? t.colors.primary : t.colors.card }, mine ? styles.bubbleMine : styles.bubbleTheirs, m.photos?.length ? styles.bubblePhotos : null]}>
                {m.photos?.length ? (
                  <View style={[styles.photos, m.photos.length > 1 && styles.photosGrid]}>
                    {m.photos.map((url, i) => (
                      <Pressable key={url} onPress={() => setViewing({ photos: m.photos!, start: i })} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${m.photos!.length}. Opens full screen`}>
                        <Image source={sizedImage(url, m.photos!.length > 1 ? 120 : 240)} style={m.photos!.length > 1 ? styles.photoSmall : styles.photoBig} contentFit="cover" transition={150} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {m.body ? <Text style={[{ color: fg }, m.photos?.length ? styles.caption : null]}>{m.body}</Text> : null}
              </View>
              <Text variant="caption" tone="muted" style={styles.time}>
                {clock(m.createdAt)}
                {item.seen ? " · Seen" : ""}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text tone="muted" style={styles.empty}>
            Say hello to {other ?? "your neighbour"}.
          </Text>
        }
      />
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
  day: { textAlign: "center", marginVertical: 8 },
  bubbleRow: { alignItems: "flex-start", gap: 2, maxWidth: "80%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubblePhotos: { padding: 4, overflow: "hidden" },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  photos: { gap: 4 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", width: 244 },
  photoBig: { width: 240, height: 240, borderRadius: 16 },
  photoSmall: { width: 120, height: 120, borderRadius: 12 },
  caption: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  time: { fontSize: 11 },
  empty: { textAlign: "center", marginTop: 40 },
  composer: { paddingHorizontal: 8, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  input: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 22, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, minHeight: MIN_TOUCH - 4 },
  inputText: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tray: { gap: 8, paddingHorizontal: 4 },
  trayTile: { width: 64, height: 64, borderRadius: 12, overflow: "hidden" },
  trayCover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  trayFailed: { backgroundColor: "rgba(185,28,28,0.6)" },
  trayRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
