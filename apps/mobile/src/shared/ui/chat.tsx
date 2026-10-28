import { Image } from "expo-image";
import { ArrowUp, FileText, Paperclip, RotateCcw, Smile, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import EmojiPicker from "rn-emoji-keyboard";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PhotoUploads } from "@/core/media/use-photo-uploads";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { sizedImage } from "@/shared/utils/media";
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

/**
 * One message: who it's from (in a group or from the team), photos, documents, the words, then the
 * time line under it. Yours on the right in the brand colour.
 */
export function ChatBubble({
  mine,
  from,
  body,
  photos = [],
  documents = [],
  meta,
  onPhoto,
}: {
  mine: boolean;
  /** Above someone else's bubble: their name, or "Ada · myHoodora team". */
  from?: string;
  body?: string;
  photos?: string[];
  documents?: ChatDocument[];
  /** Under the bubble: "2:14 pm · Seen". */
  meta?: string;
  onPhoto?: (photos: string[], index: number) => void;
}) {
  const t = useTheme();
  const fg = mine ? t.colors.primaryForeground : t.colors.foreground;
  const media = photos.length > 0;
  return (
    <View style={[styles.row, mine && styles.mine]}>
      {from && !mine ? (
        <Text variant="caption" tone="primary" style={styles.from} numberOfLines={1}>
          {from}
        </Text>
      ) : null}
      <View style={[styles.bubble, { backgroundColor: mine ? t.colors.primary : t.colors.card }, mine ? styles.bubbleMine : styles.bubbleTheirs, media && styles.bubbleMedia]}>
        {media ? (
          <View style={[styles.photos, photos.length > 1 && styles.photosGrid]}>
            {photos.map((url, i) => (
              <Pressable key={url} onPress={() => onPhoto?.(photos, i)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Opens full screen`}>
                <Image source={sizedImage(url, photos.length > 1 ? 120 : 240)} style={photos.length > 1 ? styles.photoSmall : styles.photoBig} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {documents.map((d) => (
          <Pressable
            key={d.url}
            onPress={() => void Linking.openURL(d.url)}
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
        {body ? <Text style={[{ color: fg }, (media || documents.length > 0) && styles.caption]}>{body}</Text> : null}
      </View>
      {meta ? (
        <Text variant="caption" tone="muted" style={styles.meta}>
          {meta}
        </Text>
      ) : null}
    </View>
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
}: {
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
  const [emoji, setEmoji] = useState(false);
  // Where the cursor is, so an emoji goes in where they're typing (not always at the end).
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const insert = (e: string) => {
    const at = Math.min(selection.start, text.length);
    const to = Math.min(selection.end, text.length);
    onText(text.slice(0, at) + e + text.slice(to));
    setSelection({ start: at + e.length, end: at + e.length });
  };
  const failed = uploads?.items.find((p) => p.status === "failed");
  const ready = !!uploads && uploads.urls.length > 0 && !uploads.failed;
  const canSend = (text.trim().length > 0 || ready) && !uploads?.uploading && !sending;
  return (
    <GlassSurface style={[styles.composer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {error ? <InlineAlert>{`Not sent: ${error}`}</InlineAlert> : null}
      {above}
      {uploads ? <UploadTray uploads={uploads} /> : null}
      {failed ? <InlineAlert>{`${failed.kind === "document" ? (failed.name ?? "A file") : "A photo"} didn't upload: ${failed.error ?? "try again"}. Tap it to try again, or ✕ to leave it out.`}</InlineAlert> : null}
      <View style={styles.composerRow}>
        {onAttach && (uploads?.room ?? 0) > 0 ? <IconButton Icon={Paperclip} label="Attach a photo or file" onPress={onAttach} /> : null}
        <View style={[styles.input, { backgroundColor: t.colors.muted }]}>
          <Pressable onPress={() => setEmoji(true)} accessibilityRole="button" accessibilityLabel="Add an emoji" hitSlop={6} style={styles.emojiButton}>
            <Smile size={22} color={t.colors.mutedForeground} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={onText}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
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
      <EmojiPicker
        open={emoji}
        onClose={() => setEmoji(false)}
        onEmojiSelected={(e) => insert(e.emoji)}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="top"
        theme={{
          backdrop: "rgba(0,0,0,0.35)",
          knob: t.colors.border,
          container: t.colors.card,
          header: t.colors.mutedForeground,
          skinTonesContainer: t.colors.muted,
          category: { icon: t.colors.mutedForeground, iconActive: t.colors.primary, container: t.colors.muted, containerActive: t.colors.background },
          search: { background: t.colors.muted, text: t.colors.foreground, placeholder: t.colors.mutedForeground, icon: t.colors.mutedForeground },
          emoji: { selected: t.colors.muted },
        }}
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  day: { textAlign: "center", marginVertical: 8 },
  row: { alignItems: "flex-start", gap: 2, maxWidth: "80%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
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
