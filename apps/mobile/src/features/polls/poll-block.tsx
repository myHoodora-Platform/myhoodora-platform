import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost, PollDefinition, PollResults } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { updatePostEverywhere } from "@/features/feed/use-reaction";
import { isPollClosed, percentages, timeLeft, votePoll, withVote } from "./polls-api";

/**
 * A poll in a post (Nextdoor's and X's): the choices to tap until you've voted, then bars with each
 * share and a tick on yours. While it's open you can change your vote or take it back. Votes are
 * anonymous; only counts come back.
 */
export function PollBlock({ post, poll }: { post: ApiPost; poll: PollDefinition }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const sending = useRef(false);
  const r: PollResults = post.pollResults ?? { postId: post._id, counts: {}, total: 0, myVote: null, closed: false };
  const closed = isPollClosed(poll, r);
  const showResults = closed || !!r.myVote;
  const shares = percentages(poll.options.map((o) => r.counts[o.id] ?? 0));
  const leader = Math.max(...poll.options.map((o) => r.counts[o.id] ?? 0));

  const vote = async (optionId: string | null) => {
    if (sending.current || closed) return;
    sending.current = true;
    const before = r;
    updatePostEverywhere(client, post._id, (p) => ({ ...p, pollResults: withVote(p.pollResults ?? before, optionId) }));
    try {
      const fresh = await votePoll(user, post._id, optionId);
      updatePostEverywhere(client, post._id, (p) => ({ ...p, pollResults: fresh }));
    } catch (err) {
      updatePostEverywhere(client, post._id, (p) => ({ ...p, pollResults: before }));
      toast(errorMessage(err), "error");
    } finally {
      sending.current = false;
    }
  };

  return (
    <View style={[styles.block, { borderColor: t.colors.border }]} accessibilityRole="radiogroup" accessibilityLabel="Poll">
      {poll.options.map((o, i) => {
        const mine = r.myVote === o.id;
        const share = shares[i] ?? 0;
        const top = showResults && leader > 0 && (r.counts[o.id] ?? 0) === leader;
        return (
          <Pressable
            key={o.id}
            onPress={() => void vote(mine ? null : o.id)}
            disabled={closed}
            accessibilityRole="radio"
            accessibilityState={{ checked: mine, disabled: closed }}
            accessibilityLabel={showResults ? `${o.text}, ${share}%${mine ? ", your vote" : ""}` : o.text}
            accessibilityHint={closed ? undefined : mine ? "Tap to take your vote back" : "Tap to vote"}
            // The same style keys in both states, only their colours change: Android drew a background
            // added later over the row's contents (as it squared the tab bar's pill).
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: showResults ? t.colors.muted : "transparent", borderColor: showResults ? "transparent" : t.colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {/* The bar sits in its own layer with no padding, so its percentage is exact. */}
            {showResults && share > 0 ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.fill, { width: `${share}%`, backgroundColor: mine ? tint(t.colors.primary, 0.28) : tint(t.colors.foreground, 0.08) }]} />
              </View>
            ) : null}
            <Text variant="label" style={[styles.flex, { color: showResults ? t.colors.foreground : t.colors.primary }, top && { fontFamily: t.fonts.bold }]} numberOfLines={2}>
              {o.text}
            </Text>
            {mine ? <CheckCircle2 size={18} color={t.colors.primary} /> : null}
            {showResults ? (
              <Text variant="label" style={[styles.percent, top && { fontFamily: t.fonts.bold }]}>
                {share}%
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      <View style={styles.footer}>
        <Text variant="caption" tone="muted">
          {r.total.toLocaleString()} vote{r.total === 1 ? "" : "s"} · {timeLeft(poll.closesAt)}
        </Text>
        {r.myVote && !closed ? (
          <Text variant="caption" tone="primary" onPress={() => void vote(null)} accessibilityRole="button" suppressHighlighting>
            Take back my vote
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginHorizontal: 16, padding: 12, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  option: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: MIN_TOUCH - 4, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  fill: { height: "100%" },
  percent: { minWidth: 40, textAlign: "right" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 2, paddingTop: 2 },
});
