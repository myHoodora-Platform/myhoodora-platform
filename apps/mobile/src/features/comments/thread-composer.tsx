import type { ApiPost } from "@myhoodora/api-contract/types";
import { ArrowUp, X } from "lucide-react-native";
import { forwardRef, useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useAuth } from "@/core/auth/auth-provider";
import { COMMENT_MAX, ComposerLock, composerLocked } from "./composer-lock";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { commentDrafts, type Draft } from "./comment-drafts";

/** Tapped into the text at the end; a quick way to answer without the keyboard's emoji page. */
const QUICK = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

/**
 * The reply box pinned to the bottom of the comments sheet: "Comment as Ada…", a row of quick emoji
 * while typing, "Replying to Tunde ✕" when answering someone, and send (off while empty). What you
 * type is kept per post if you close the sheet. `send` returns false when nothing was sent.
 */
export const ThreadComposer = forwardRef<
  TextInput,
  {
    post: ApiPost;
    replyTo?: Draft["replyTo"];
    onCancelReply: () => void;
    send: (text: string, replyTo?: Draft["replyTo"]) => boolean;
    /** At the bottom of a screen (not a sheet, which handles it): room for the home indicator while the keyboard is down. */
    safeBottom?: number;
  }
>(function ThreadComposer(
  { post, replyTo, onCancelReply, send, safeBottom = 0 },
  ref,
) {
  const t = useTheme();
  const { profile } = useAuth();
  const [text, setText] = useState(() => commentDrafts.get(post._id).text);
  const [focused, setFocused] = useState(false);
  useEffect(() => commentDrafts.set(post._id, { text, replyTo }), [post._id, text, replyTo]);

  if (composerLocked(post, profile)) {
    return (
      <View style={[styles.wrap, { borderTopColor: t.colors.border, backgroundColor: t.colors.background, paddingBottom: Math.max(10, safeBottom) }]}>
        <ComposerLock post={post} />
      </View>
    );
  }

  const canSend = text.trim().length > 0;
  const submit = () => {
    if (send(text, replyTo)) {
      setText("");
      commentDrafts.clear(post._id);
      onCancelReply();
    }
  };
  const first = profile?.displayName?.split(/\s+/)[0] ?? "you";
  return (
    <View style={[styles.wrap, { borderTopColor: t.colors.border, backgroundColor: t.colors.background, paddingBottom: focused ? 10 : Math.max(10, safeBottom) }]}>
      {focused || text ? (
        <View style={styles.quick} accessibilityRole="toolbar" accessibilityLabel="Quick emoji">
          {QUICK.map((e) => (
            <Pressable key={e} onPress={() => setText((v) => `${v}${e}`)} accessibilityRole="button" accessibilityLabel={`Add ${e}`} hitSlop={4} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
              <Text style={styles.quickEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {replyTo ? (
        <View style={styles.replying}>
          <Text variant="caption" tone="muted" style={styles.flex}>
            Replying to <Text variant="caption" style={{ fontFamily: t.fonts.semibold }}>{replyTo.name}</Text>
          </Text>
          <Pressable onPress={onCancelReply} accessibilityRole="button" accessibilityLabel="Stop replying" hitSlop={10}>
            <X size={16} color={t.colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={34} />
        <View style={[styles.input, { backgroundColor: t.colors.muted, borderColor: focused ? t.colors.ring : "transparent" }]}>
          <TextInput
            ref={ref}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={replyTo ? `Reply to ${replyTo.name.split(/\s+/)[0]}…` : `Comment as ${first}…`}
            placeholderTextColor={t.colors.mutedForeground}
            multiline
            maxLength={COMMENT_MAX}
            accessibilityLabel={replyTo ? `Reply to ${replyTo.name}` : "Write a comment"}
            style={[styles.inputText, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            accessibilityState={{ disabled: !canSend }}
            hitSlop={8}
            style={[styles.send, { backgroundColor: canSend ? t.colors.primary : "transparent" }]}
          >
            <ArrowUp size={18} color={canSend ? t.colors.primaryForeground : t.colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  quick: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  quickItem: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  pressed: { transform: [{ scale: 1.2 }] },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
  replying: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 22, borderWidth: 1.5, paddingLeft: 14, paddingRight: 4, paddingVertical: 3, minHeight: MIN_TOUCH - 4 },
  inputText: { flex: 1, fontSize: 16, lineHeight: 21, maxHeight: 112, paddingTop: 9, paddingBottom: 9 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 1 },
});
