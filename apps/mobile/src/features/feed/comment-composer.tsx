import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost, Comment } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, MailCheck } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { addComment, feedKeys, resendVerificationEmail } from "./feed-api";

/** The API's limit (contract §2), and where a counter starts helping. */
export const COMMENT_MAX = 1000;
const COUNTER_FROM = 800;

/** A comment shown before the API has it: its id says so. */
export const PENDING_PREFIX = "pending-";
export const isPending = (c: Comment) => c._id.startsWith(PENDING_PREFIX);

/**
 * The reply box at the bottom of a post. Sending shows your comment at once (marked "Sending…"); if
 * the API refuses, it's taken back and your words return to the box with the reason, never lost.
 * Without a confirmed email the API won't take comments, so the box says so up front instead.
 */
export const CommentComposer = forwardRef<TextInput, { post: ApiPost; onSent?: () => void }>(function CommentComposer({ post, onSent }, ref) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const content = text.trim();
  const canSend = content.length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setProblem(null);
    const temp: Comment = {
      _id: `${PENDING_PREFIX}${Date.now()}`,
      postId: post._id,
      authorUid: user.uid,
      author: { uid: user.uid, displayName: profile?.displayName ?? "You", photoURL: profile?.photoURL },
      content,
      createdAt: new Date().toISOString(),
      likes: [],
    };
    client.setQueryData<Comment[]>(feedKeys.comments(post._id), (rows) => [...(rows ?? []), temp]);
    setText("");
    onSent?.();
    try {
      await addComment(user, post._id, content);
      client.setQueryData<ApiPost>(feedKeys.post(post._id), (p) => (p ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p));
      await client.invalidateQueries({ queryKey: feedKeys.comments(post._id) });
      void client.invalidateQueries({ queryKey: feedKeys.all });
    } catch (err) {
      client.setQueryData<Comment[]>(feedKeys.comments(post._id), (rows) => rows?.filter((c) => c._id !== temp._id));
      setText((now) => (now ? now : content));
      setProblem(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <GlassSurface style={[styles.wrap, { borderTopColor: t.colors.border, paddingBottom: focused ? 8 : Math.max(insets.bottom, 8) }]}>{children}</GlassSurface>
  );

  // A neighbourhood they only follow: they can read the conversation, not join it (contract §31).
  if (profile?.neighborhoodId && post.neighborhoodId !== profile.neighborhoodId) {
    return shell(
      <View style={styles.locked}>
        <Text variant="caption" tone="muted" style={styles.flex}>
          You follow this neighbourhood, so you can read along. Comments are for neighbours who live here.
        </Text>
      </View>,
    );
  }

  if (profile?.emailVerified === false) {
    return shell(
      <View style={styles.locked}>
        <MailCheck size={20} color={t.colors.primary} />
        <Text variant="caption" style={styles.flex}>
          Confirm your email to join the conversation.
        </Text>
        <Text
          variant="label"
          tone="primary"
          accessibilityRole="button"
          onPress={() => resendVerificationEmail(user).then(() => toast(`New link sent to ${profile.email ?? user.email ?? "your email"}.`), (err: unknown) => toast(errorMessage(err), "error"))}
        >
          Resend link
        </Text>
      </View>,
    );
  }

  return shell(
    <>
      {problem ? <InlineAlert>{`Your comment wasn't posted: ${problem}`}</InlineAlert> : null}
      <View style={styles.row}>
        <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={34} />
        <View style={[styles.input, { backgroundColor: t.colors.muted, borderColor: focused ? t.colors.ring : "transparent" }]}>
          <TextInput
            ref={ref}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (problem) setProblem(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`Comment as ${profile?.displayName?.split(/\s+/)[0] ?? "you"}…`}
            placeholderTextColor={t.colors.mutedForeground}
            multiline
            maxLength={COMMENT_MAX}
            accessibilityLabel="Add a comment"
            style={[styles.inputText, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {canSend ? (
            <Pressable onPress={() => void send()} accessibilityRole="button" accessibilityLabel="Post comment" hitSlop={8} style={[styles.send, { backgroundColor: t.colors.primary }]}>
              <ArrowUp size={18} color={t.colors.primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {text.length >= COUNTER_FROM ? (
        <Text variant="caption" tone={text.length >= COMMENT_MAX ? "destructive" : "muted"} style={styles.counter}>
          {text.length} / {COMMENT_MAX}
        </Text>
      ) : null}
    </>,
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { paddingHorizontal: 12, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 22, borderWidth: 1.5, paddingLeft: 14, paddingRight: 4, paddingVertical: 3, minHeight: MIN_TOUCH - 4 },
  // About five lines, then it scrolls inside.
  inputText: { flex: 1, fontSize: 16, lineHeight: 21, maxHeight: 112, paddingTop: 9, paddingBottom: 9 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  counter: { textAlign: "right", paddingRight: 8 },
  locked: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH, paddingHorizontal: 4 },
});
