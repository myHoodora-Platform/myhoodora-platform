import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import type { Prompt } from "@myhoodora/api-contract/prompts";
import { CheckCircle2, Star } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { accent } from "@/shared/theme/accents";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { answerPrompt } from "./feedback-api";

const STAR_WORDS = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

/**
 * A feedback prompt's content, the same in every layout: a header (emoji on its colour, the question,
 * any detail), the input for its kind, a comment box once there's something to comment on, and Send.
 * After sending, a thank-you, then `onDone`. Answers count once (an earlier answer counts as done).
 */
export function PromptBody({ prompt, onDone, compact = false }: { prompt: Prompt; onDone: () => void; compact?: boolean }) {
  const t = useTheme();
  const user = useSignedInUser();
  const [value, setValue] = useState<number | undefined>(undefined);
  const [optionId, setOptionId] = useState<string | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [bg, fg] = accent(prompt.accent, t.scheme);

  const chosen = prompt.kind === "poll" ? !!optionId : prompt.kind === "open" ? true : value !== undefined;
  const showComment = prompt.commentMode !== "off" && chosen;
  const needComment = prompt.commentMode === "required";
  const canSend = chosen && (!needComment || comment.trim().length > 0) && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setProblem(null);
    try {
      const res = await answerPrompt(user, prompt._id, { value, optionId, comment: comment.trim() || undefined, contextKey: prompt.contextKey, subjectId: prompt.subjectId, platform: Platform.OS === "ios" ? "ios" : "android" });
      setThanks(res.thanks);
      setTimeout(onDone, 1800);
    } catch (err) {
      // Answered already (another device, a double tap): that's done, not a failure.
      if (err instanceof ApiError && err.status === 409) {
        setThanks("Thank you! We already have your answer.");
        setTimeout(onDone, 1500);
      } else setProblem(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (thanks) {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={styles.thanks} accessibilityLiveRegion="polite">
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <CheckCircle2 size={48} color={t.colors.success} />
        </Animated.View>
        <Text variant="heading" style={styles.centre}>
          {thanks}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.body, compact && styles.compact]}>
      <View style={styles.head}>
        {prompt.emoji ? (
          <View style={[styles.emojiWrap, { backgroundColor: bg }]}>
            <Text style={styles.emoji}>{prompt.emoji}</Text>
          </View>
        ) : null}
        <Text variant="heading" style={[styles.centre, { color: t.colors.foreground }]} accessibilityRole="header">
          {prompt.question}
        </Text>
        {prompt.detail ? (
          <Text tone="muted" style={styles.centre}>
            {prompt.detail}
          </Text>
        ) : null}
      </View>

      {prompt.kind === "stars" ? <Stars value={value} onChange={setValue} color={fg} /> : null}
      {prompt.kind === "thumbs" ? <Thumbs value={value} onChange={setValue} fill={bg} color={fg} /> : null}
      {prompt.kind === "nps" ? <Nps value={value} onChange={setValue} /> : null}
      {prompt.kind === "poll" ? <Poll prompt={prompt} value={optionId} onChange={setOptionId} fill={bg} color={fg} /> : null}

      {showComment || prompt.kind === "open" ? (
        <Animated.View entering={FadeIn.duration(160)}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
            placeholder={prompt.commentLabel || (prompt.kind === "open" ? "Write your answer" : needComment ? "Tell us a little more" : "Tell us more (optional)")}
            placeholderTextColor={t.colors.mutedForeground}
            accessibilityLabel={prompt.commentLabel || "Your comment"}
            style={[styles.comment, { backgroundColor: t.colors.muted, color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
        </Animated.View>
      ) : null}

      {problem ? <InlineAlert>{`Your answer wasn't sent: ${problem}`}</InlineAlert> : null}
      <Button label="Send" onPress={() => void send()} disabled={!canSend} loading={sending} />
    </View>
  );
}

/** Five stars, each a word when chosen ("Good"); tap again to change. */
function Stars({ value, onChange, color }: { value?: number; onChange: (v: number) => void; color: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Rating">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== undefined && n <= value;
          return (
            <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} star${n > 1 ? "s" : ""}: ${STAR_WORDS[n - 1]}`} style={styles.starHit}>
              <Animated.View key={on ? `on${n}` : `off${n}`} entering={on ? ZoomIn.duration(160) : undefined}>
                <Star size={36} color={on ? "#F5B301" : t.colors.border} fill={on ? "#F5B301" : "transparent"} strokeWidth={1.6} />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
      <Text variant="label" style={{ color: value ? color : t.colors.mutedForeground }}>
        {value ? STAR_WORDS[value - 1] : "Tap a star"}
      </Text>
    </View>
  );
}

/** Two big choices: 👍 Yes / 👎 Not really. */
function Thumbs({ value, onChange, fill, color }: { value?: number; onChange: (v: number) => void; fill: string; color: string }) {
  const t = useTheme();
  const choices = [
    { v: 1, emoji: "👍", label: "Yes" },
    { v: 0, emoji: "👎", label: "Not really" },
  ];
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {choices.map((c) => {
        const on = value === c.v;
        return (
          <Pressable
            key={c.v}
            onPress={() => onChange(c.v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.label}
            style={({ pressed }) => [styles.thumb, { backgroundColor: on ? fill : t.colors.muted, borderColor: on ? color : "transparent", opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.thumbEmoji, on && styles.big]}>{c.emoji}</Text>
            <Text variant="label" style={{ color: on ? color : t.colors.foreground }}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 0–10, coloured from "not likely" to "very likely". */
function Nps({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const tone = (n: number) => (n <= 6 ? t.colors.destructive : n <= 8 ? "#D97706" : t.colors.success);
  return (
    <View style={styles.npsWrap}>
      <View style={styles.npsRow} accessibilityRole="radiogroup" accessibilityLabel="0 is not at all likely, 10 is extremely likely">
        {Array.from({ length: 11 }, (_, n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={String(n)}
              style={[styles.npsCell, { backgroundColor: on ? tone(n) : tint(tone(n), 0.12) }]}
            >
              <Text variant="label" style={{ color: on ? "#fff" : tone(n) }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.npsEnds}>
        <Text variant="caption" tone="muted">
          Not likely
        </Text>
        <Text variant="caption" tone="muted">
          Very likely
        </Text>
      </View>
    </View>
  );
}

/** One choice from a short list, each with its emoji. */
function Poll({ prompt, value, onChange, fill, color }: { prompt: Prompt; value?: string; onChange: (id: string) => void; fill: string; color: string }) {
  const t = useTheme();
  return (
    <View style={styles.poll} accessibilityRole="radiogroup">
      {prompt.options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.option, { backgroundColor: on ? fill : t.colors.muted, borderColor: on ? color : "transparent", opacity: pressed ? 0.85 : 1 }]}
          >
            {o.emoji ? <Text style={styles.optionEmoji}>{o.emoji}</Text> : null}
            <Text variant="label" style={[styles.flex, { color: on ? color : t.colors.foreground }]}>
              {o.label}
            </Text>
            <View style={[styles.radio, { borderColor: on ? color : t.colors.border }]}>{on ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: 16, padding: 20 },
  compact: { padding: 16, gap: 14 },
  head: { alignItems: "center", gap: 8 },
  emojiWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 28, lineHeight: 34 },
  centre: { textAlign: "center" },
  center: { alignItems: "center", gap: 6 },
  row: { flexDirection: "row", justifyContent: "center", gap: 10 },
  starHit: { padding: 4 },
  thumb: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 2 },
  thumbEmoji: { fontSize: 30, lineHeight: 36 },
  big: { fontSize: 36, lineHeight: 42 },
  npsWrap: { gap: 6 },
  npsRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  npsCell: { flex: 1, aspectRatio: 0.8, minHeight: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  npsEnds: { flexDirection: "row", justifyContent: "space-between" },
  poll: { gap: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 2 },
  optionEmoji: { fontSize: 22, lineHeight: 28 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  comment: { minHeight: 80, maxHeight: 160, borderRadius: 14, padding: 12, fontSize: 16, textAlignVertical: "top" },
  thanks: { alignItems: "center", gap: 12, padding: 28 },
});
