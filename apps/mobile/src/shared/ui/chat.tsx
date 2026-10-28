import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ArrowUp, Ban, ChevronsRight, Delete, Forward, FileText, Keyboard as KeyboardIcon, Paperclip, Reply, RotateCcw, Smile, X } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { ActivityIndicator, BackHandler, Keyboard, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PhotoUploads } from "@/core/media/use-photo-uploads";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { sizedImage } from "@/shared/utils/media";
import { deleteBackward, insertAt } from "@/shared/utils/emoji-text";
import { dayLabel } from "@/shared/utils/time";
import { GlassSurface } from "./glass-surface";
import { IconButton } from "./icon-button";
import { InlineAlert } from "./inline-alert";
import { Text } from "./text";

/**
 * The pieces every conversation in the app is made of (Messages and Support alike), so they look and
 * work the same: day lines, bubbles with photos and documents, the tray of files about to go, and the
 * composer with its attach button.
 */

export interface ChatDocument {
  url: string;
  name?: string;
  bytes?: number;
}

export type DayRows<T> = ({ kind: "day"; key: string; label: string } | { kind: "item"; key: string; item: T })[];

/** Items with a day line ("Today", "Mon 26 Oct") wherever the day changes. */
export function withDays<T>(items: T[], at: (item: T) => string, key: (item: T, i: number) => string, now = new Date()): DayRows<T> {
  const rows: DayRows<T> = [];
  items.forEach((item, i) => {
    const day = dayLabel(at(item), now);
    if (i === 0 || dayLabel(at(items[i - 1]!), now) !== day) rows.push({ kind: "day", key: `day-${key(item, i)}`, label: day });
    rows.push({ kind: "item", key: key(item, i), item });
  });
  return rows;
}

export function DayLine({ label }: { label: string }) {
  return (
    <Text variant="caption" tone="muted" style={styles.day} accessibilityRole="header">
      {label}
    </Text>
  );
}

/** "2.4 MB", "820 KB". */
export function fileSize(bytes?: number): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** What a reply quotes, inside the bubble: who wrote it and a line of it. Tap to jump to it. */
export interface BubbleQuote {
  who: string;
  body: string;
  photo?: boolean;
  deleted?: boolean;
  onPress?: () => void;
}

/** Reactions under a bubble, grouped: "👍 3", with whether one of them is yours. */
export interface BubbleReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Where a bubble is on screen, for the long-press menu to sit around it. */
export interface BubbleFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BubbleContent {
  mine: boolean;
  body?: string;
  photos?: string[];
  documents?: ChatDocument[];
  quote?: BubbleQuote;
  deleted?: boolean;
  /** It came from another chat: "Forwarded", or "Forwarded many times" (WhatsApp). */
  forwarded?: "once" | "many";
}

/** The bubble itself (no row, no gestures): also what the long-press menu shows lifted. */
export function BubbleBody({ mine, body, photos = [], documents = [], quote, deleted, forwarded, onPhoto, onLongPress }: BubbleContent & { onPhoto?: (photos: string[], index: number) => void; onLongPress?: () => void }) {
  const t = useTheme();
  const fg = mine ? t.colors.primaryForeground : t.colors.foreground;
  const media = !deleted && photos.length > 0;
  return (
    <View style={[styles.bubble, { backgroundColor: mine ? t.colors.primary : t.colors.card }, mine ? styles.bubbleMine : styles.bubbleTheirs, media && styles.bubbleMedia]}>
      {forwarded && !deleted ? (
        <View style={[styles.forwarded, media && styles.forwardedInMedia]}>
          {forwarded === "many" ? <ChevronsRight size={14} color={fg} style={styles.faint} /> : <Forward size={14} color={fg} style={styles.faint} />}
          <Text variant="caption" style={[{ color: fg }, styles.faint]}>
            {forwarded === "many" ? "Forwarded many times" : "Forwarded"}
          </Text>
        </View>
      ) : null}
      {quote && !deleted ? (
        <Pressable
          onPress={quote.onPress}
          onLongPress={onLongPress}
          disabled={!quote.onPress}
          accessibilityRole="button"
          accessibilityLabel={`Replying to ${quote.who}: ${quote.deleted ? "a deleted message" : quote.body || "a photo"}. Shows it`}
          style={[styles.quote, { backgroundColor: mine ? "rgba(255,255,255,0.16)" : t.colors.muted, borderLeftColor: mine ? t.colors.primaryForeground : t.colors.primary }, media && styles.quoteInMedia]}
        >
          <Text variant="caption" numberOfLines={1} style={{ color: mine ? fg : t.colors.primary, fontFamily: t.fonts.semibold }}>
            {quote.who}
          </Text>
          <Text variant="caption" numberOfLines={2} style={{ color: fg, opacity: quote.deleted ? 0.7 : 0.85 }}>
            {quote.deleted ? "This message was deleted" : quote.body || (quote.photo ? "📷 Photo" : "")}
          </Text>
        </Pressable>
      ) : null}
      {deleted ? (
        // Not italic: Android measures italic text in a custom font short and cuts off its end.
        <View style={styles.deleted}>
          <Ban size={15} color={fg} style={{ opacity: 0.7 }} />
          <Text style={{ color: fg, opacity: 0.75 }}>{mine ? "You deleted this message" : "This message was deleted"}</Text>
        </View>
      ) : null}
      {media ? (
        <View style={[styles.photos, photos.length > 1 && styles.photosGrid]}>
          {photos.map((url, i) => (
            <Pressable key={url} onPress={() => onPhoto?.(photos, i)} onLongPress={onLongPress} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Opens full screen`}>
              <Image source={sizedImage(url, photos.length > 1 ? 120 : 240)} style={photos.length > 1 ? styles.photoSmall : styles.photoBig} contentFit="cover" transition={150} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {deleted
        ? null
        : documents.map((d) => (
            <Pressable
              key={d.url}
              onPress={() => void Linking.openURL(d.url)}
              onLongPress={onLongPress}
              accessibilityRole="link"
              accessibilityLabel={`Document ${d.name ?? ""} ${fileSize(d.bytes)}. Opens it`}
              style={[styles.doc, { backgroundColor: mine ? "rgba(255,255,255,0.16)" : t.colors.muted }, media && styles.docInMedia]}
            >
              <View style={[styles.docIcon, { backgroundColor: mine ? "rgba(255,255,255,0.22)" : t.colors.dangerSoft }]}>
                <FileText size={18} color={mine ? fg : t.colors.destructive} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={1} style={{ color: fg }}>
                  {d.name ?? "Document"}
                </Text>
                <Text variant="caption" style={{ color: fg, opacity: 0.75 }}>
                  PDF{d.bytes ? ` · ${fileSize(d.bytes)}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
      {!deleted && body ? <Text style={[{ color: fg }, (media || documents.length > 0) && styles.caption]}>{body}</Text> : null}
    </View>
  );
}

/** How far a swipe must go to reply, and how far the bubble follows the finger. */
const SWIPE_REPLY = 56;
const SWIPE_MAX = 80;

/**
 * One message: who it's from (in a group or from the team), the quote it replies to, photos,
 * documents, the words, its reactions, then the time line. Yours on the right in the brand colour.
 * Hold it for the message menu; swipe it right to reply (WhatsApp's two gestures).
 */
export function ChatBubble({
  mine,
  from,
  body,
  photos = [],
  documents = [],
  quote,
  deleted,
  forwarded,
  reactions,
  meta,
  highlighted = false,
  onPhoto,
  onLongPress,
  onSwipeReply,
  onReactions,
}: BubbleContent & {
  /** Above someone else's bubble: their name, or "Ada · myHoodora team". */
  from?: string;
  reactions?: BubbleReaction[];
  /** Under the bubble: "2:14 pm · Edited · Seen". */
  meta?: string;
  /** Briefly ringed after jumping to it from a reply. */
  highlighted?: boolean;
  onPhoto?: (photos: string[], index: number) => void;
  onLongPress?: (frame: BubbleFrame) => void;
  onSwipeReply?: () => void;
  onReactions?: () => void;
}) {
  const t = useTheme();
  const ref = useRef<View>(null);
  const dx = useSharedValue(0);
  const hold = () => {
    if (!onLongPress) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    ref.current?.measureInWindow((x, y, width, height) => onLongPress({ x, y, width, height }));
  };
  const replied = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onSwipeReply?.();
  };
  const swipe = Gesture.Pan()
    .enabled(!!onSwipeReply && !deleted)
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      dx.set(Math.max(0, Math.min(SWIPE_MAX, e.translationX)));
    })
    .onEnd(() => {
      if (dx.get() >= SWIPE_REPLY) runOnJS(replied)();
      dx.set(withSpring(0, { damping: 20, stiffness: 260 }));
    });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }] }));
  const hint = useAnimatedStyle(() => ({ opacity: Math.min(1, dx.get() / SWIPE_REPLY), transform: [{ scale: 0.6 + 0.4 * Math.min(1, dx.get() / SWIPE_REPLY) }] }));
  const shown = reactions?.filter((r) => r.count > 0) ?? [];
  const total = shown.reduce((n, r) => n + r.count, 0);

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[styles.row, mine && styles.mine]}>
        {onSwipeReply ? (
          <Animated.View pointerEvents="none" style={[styles.swipeHint, { backgroundColor: t.colors.muted }, hint]}>
            <Reply size={16} color={t.colors.foreground} />
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.column, mine && styles.mine, slide]}>
          {from && !mine ? (
            <Text variant="caption" tone="primary" style={styles.from} numberOfLines={1}>
              {from}
            </Text>
          ) : null}
          <Pressable onLongPress={hold} delayLongPress={280} accessibilityHint={onLongPress ? "Hold for reply, react and more" : undefined} accessibilityActions={onLongPress ? [{ name: "longpress", label: "Message options" }] : undefined} onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && hold()}>
            {/* Always ringed (transparent unless highlighted): Android draws a border added later wrongly. */}
            <View ref={ref} collapsable={false} style={[styles.ring, { borderColor: highlighted ? t.colors.primary : "transparent" }]}>
              <BubbleBody mine={mine} body={body} photos={photos} documents={documents} quote={quote} deleted={deleted} forwarded={forwarded} onPhoto={onPhoto} onLongPress={hold} />
            </View>
          </Pressable>
          {shown.length ? (
            <Pressable
              onPress={onReactions}
              accessibilityRole="button"
              accessibilityLabel={`Reactions: ${shown.map((r) => `${r.emoji} ${r.count}`).join(", ")}. Shows who reacted`}
              style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            >
              <Text style={styles.reactionEmoji}>{shown.slice(0, 3).map((r) => r.emoji).join("")}</Text>
              {total > 1 ? (
                <Text variant="caption" tone="muted">
                  {total}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
          {meta ? (
            <Text variant="caption" tone="muted" style={styles.meta}>
              {meta}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Files about to go, each with its upload state; tap ✕ to leave one out, tap a failed one to retry. */
export function UploadTray({ uploads }: { uploads: PhotoUploads }) {
  const t = useTheme();
  if (!uploads.items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
      {uploads.items.map((p, i) => {
        const what = p.kind === "document" ? (p.name ?? "Document") : `Photo ${i + 1}`;
        return (
          <View key={p.key} style={[p.kind === "document" ? styles.trayDoc : styles.trayTile, { backgroundColor: t.colors.muted }]}>
            {p.kind === "document" ? (
              <View style={styles.trayDocBody}>
                <FileText size={18} color={t.colors.destructive} />
                <Text variant="caption" numberOfLines={2} style={styles.flex}>
                  {p.name ?? "Document"}
                </Text>
              </View>
            ) : (
              <Image source={p.uri} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            )}
            {p.status === "uploading" ? (
              <View style={styles.trayCover} accessible accessibilityLabel={`${what}, uploading`}>
                <ActivityIndicator color="#ffffff" size="small" />
              </View>
            ) : null}
            {p.status === "failed" ? (
              <Pressable onPress={() => uploads.retry(p.key)} accessibilityRole="button" accessibilityLabel={`${what} didn't upload. Retry`} style={[styles.trayCover, styles.trayFailed]}>
                <RotateCcw size={18} color="#ffffff" />
              </Pressable>
            ) : null}
            <Pressable onPress={() => uploads.remove(p.key)} accessibilityRole="button" accessibilityLabel={`Remove ${what}`} hitSlop={8} style={styles.trayRemove}>
              <X size={12} color="#ffffff" />
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * The bar at the bottom of a conversation: attach (when there's room), the text box, and send, which
 * shows once there's something to send. `above` holds notes and the attach menu's sheet.
 */
export function ChatComposer({
  text,
  onText,
  placeholder,
  uploads,
  onAttach,
  onSend,
  sending,
  error,
  above,
  banner,
}: {
  /** Above the box: "Replying to Ada" or "Editing", with ✕ (WhatsApp's reply bar). */
  banner?: { title: string; body: string; onCancel: () => void } | null;
  text: string;
  onText: (text: string) => void;
  placeholder: string;
  uploads?: PhotoUploads;
  onAttach?: () => void;
  onSend: () => void;
  sending: boolean;
  /** Why the last one didn't go. */
  error?: string | null;
  above?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  // WhatsApp's way: the emoji panel takes the keyboard's place, at the keyboard's height, under the box.
  const [emoji, setEmoji] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", (e) => setPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.round(e.endCoordinates.height))));
    return () => sub.remove();
  }, []);
  // Android's back closes the panel first, as on WhatsApp, rather than leaving the conversation.
  useEffect(() => {
    if (!emoji) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setEmoji(false);
      return true;
    });
    return () => sub.remove();
  }, [emoji]);
  // Where the cursor is, so an emoji goes in where they're typing (not always at the end).
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  // Set only right after an emoji goes in or comes out; otherwise the cursor is the person's own.
  const [placed, setPlaced] = useState<{ start: number; end: number } | undefined>(undefined);
  const edit = ({ text: next, cursor }: { text: string; cursor: number }) => {
    onText(next);
    setSelection({ start: cursor, end: cursor });
    setPlaced({ start: cursor, end: cursor });
  };
  const showEmoji = () => {
    Keyboard.dismiss();
    setEmoji(true);
  };
  const showKeyboard = () => {
    setEmoji(false);
    input.current?.focus();
  };
  const failed = uploads?.items.find((p) => p.status === "failed");
  const ready = !!uploads && uploads.urls.length > 0 && !uploads.failed;
  const canSend = (text.trim().length > 0 || ready) && !uploads?.uploading && !sending;
  return (
    <GlassSurface style={[styles.composer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {error ? <InlineAlert>{`Not sent: ${error}`}</InlineAlert> : null}
      {above}
      {uploads ? <UploadTray uploads={uploads} /> : null}
      {banner ? (
        <View style={[styles.banner, { backgroundColor: t.colors.muted, borderLeftColor: t.colors.primary }]} accessibilityLiveRegion="polite">
          <View style={styles.flex}>
            <Text variant="caption" tone="primary" numberOfLines={1} style={{ fontFamily: t.fonts.semibold }}>
              {banner.title}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {banner.body}
            </Text>
          </View>
          <Pressable onPress={banner.onCancel} accessibilityRole="button" accessibilityLabel={`Cancel: ${banner.title}`} hitSlop={10}>
            <X size={18} color={t.colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}
      {failed ? <InlineAlert>{`${failed.kind === "document" ? (failed.name ?? "A file") : "A photo"} didn't upload: ${failed.error ?? "try again"}. Tap it to try again, or ✕ to leave it out.`}</InlineAlert> : null}
      <View style={styles.composerRow}>
        {onAttach && (uploads?.room ?? 0) > 0 ? <IconButton Icon={Paperclip} label="Attach a photo or file" onPress={onAttach} /> : null}
        <View style={[styles.input, { backgroundColor: t.colors.muted }]}>
          <Pressable
            onPress={emoji ? showKeyboard : showEmoji}
            accessibilityRole="button"
            accessibilityLabel={emoji ? "Show the keyboard" : "Show emoji"}
            hitSlop={6}
            style={styles.emojiButton}
          >
            {emoji ? <KeyboardIcon size={22} color={t.colors.mutedForeground} /> : <Smile size={22} color={t.colors.mutedForeground} />}
          </Pressable>
          <TextInput
            ref={input}
            value={text}
            onChangeText={(v) => {
              onText(v);
              setPlaced(undefined);
            }}
            selection={placed}
            onSelectionChange={(e) => {
              setSelection(e.nativeEvent.selection);
              setPlaced(undefined);
            }}
            // Typing again: the keyboard comes back in the panel's place.
            onFocus={() => setEmoji(false)}
            showSoftInputOnFocus
            placeholder={uploads?.items.length ? "Add a message (optional)" : placeholder}
            placeholderTextColor={t.colors.mutedForeground}
            multiline
            maxLength={2000}
            accessibilityLabel={placeholder}
            style={[styles.inputText, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {canSend || sending ? (
            <Pressable onPress={() => canSend && onSend()} accessibilityRole="button" accessibilityLabel="Send" style={[styles.send, { backgroundColor: t.colors.primary }]}>
              {sending ? <ActivityIndicator size="small" color={t.colors.primaryForeground} /> : <ArrowUp size={18} color={t.colors.primaryForeground} />}
            </Pressable>
          ) : null}
        </View>
      </View>
      {emoji ? (
        <View style={[styles.panel, { height: panelHeight }]}>
          <EmojiKeyboard
            onEmojiSelected={(e) => edit(insertAt(text, e.emoji, selection))}
            allowMultipleSelections
            selectedEmojis={false}
            enableRecentlyUsed
            categoryPosition="bottom"
            disableSafeArea
            emojiSize={30}
            theme={{
              container: t.colors.card,
              header: t.colors.mutedForeground,
              knob: "transparent",
              skinTonesContainer: t.colors.muted,
              category: { icon: t.colors.mutedForeground, iconActive: t.colors.primary, container: t.colors.card, containerActive: t.colors.muted },
              emoji: { selected: t.colors.muted },
            }}
            // Room at the right of the category bar for ⌫, as on WhatsApp.
            styles={{ container: { flex: 1, borderRadius: 0, shadowOpacity: 0, elevation: 0 }, category: { container: { paddingRight: BACKSPACE_ROOM } } }}
          />
          <Pressable
            onPress={() => edit(deleteBackward(text, selection.start === selection.end ? selection.start : selection.end))}
            onLongPress={() => edit({ text: "", cursor: 0 })}
            accessibilityRole="button"
            accessibilityLabel="Delete"
            accessibilityHint="Hold to clear the message"
            hitSlop={6}
            style={[styles.backspace, { backgroundColor: t.colors.card }]}
          >
            <Delete size={22} color={t.colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}
    </GlassSurface>
  );
}

/** Before the keyboard has been seen: about a phone keyboard's height. */
const DEFAULT_PANEL_HEIGHT = 290;
const MIN_PANEL_HEIGHT = 240;
const BACKSPACE_ROOM = 52;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { marginHorizontal: -8, marginBottom: -8 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: 4 },
  backspace: { position: "absolute", right: 0, bottom: 0, width: BACKSPACE_ROOM, height: 48, alignItems: "center", justifyContent: "center" },
  day: { textAlign: "center", marginVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  column: { alignItems: "flex-start", gap: 2, maxWidth: "80%" },
  mine: { justifyContent: "flex-end", alignItems: "flex-end", alignSelf: "flex-end" },
  swipeHint: { position: "absolute", left: 4, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 2, borderRadius: 22, margin: -2 },
  deleted: { flexDirection: "row", alignItems: "center", gap: 6 },
  forwarded: { flexDirection: "row", alignItems: "center", gap: 4 },
  forwardedInMedia: { paddingHorizontal: 8, paddingTop: 4 },
  faint: { opacity: 0.7 },
  quote: { borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 1, minWidth: 140 },
  quoteInMedia: { margin: 4, marginBottom: 2 },
  reactions: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginTop: -10, minHeight: 26 },
  reactionsMine: { marginRight: 10 },
  reactionsTheirs: { marginLeft: 10 },
  reactionEmoji: { fontSize: 15, lineHeight: 20 },
  from: { marginLeft: 6 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6 },
  bubbleMedia: { padding: 4, overflow: "hidden" },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  photos: { gap: 4 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", width: 244 },
  photoBig: { width: 240, height: 240, borderRadius: 16 },
  photoSmall: { width: 120, height: 120, borderRadius: 12 },
  caption: { paddingHorizontal: 10, paddingTop: 2, paddingBottom: 4 },
  doc: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 8, minWidth: 220, minHeight: MIN_TOUCH },
  docInMedia: { marginTop: 2 },
  docIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  meta: { fontSize: 11, marginHorizontal: 6 },
  composer: { paddingHorizontal: 8, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  input: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 22, paddingLeft: 6, paddingRight: 4, paddingVertical: 4, minHeight: MIN_TOUCH - 4 },
  emojiButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  inputText: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tray: { gap: 8, paddingHorizontal: 4 },
  trayTile: { width: 64, height: 64, borderRadius: 12, overflow: "hidden" },
  trayDoc: { width: 150, height: 64, borderRadius: 12, overflow: "hidden" },
  trayDocBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingRight: 24 },
  trayCover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  trayFailed: { backgroundColor: "rgba(185,28,28,0.6)" },
  trayRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
