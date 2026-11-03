import type { ApiPost } from "@myhoodora/api-contract/types";
import { errorMessage } from "@myhoodora/api-contract/errors";
import { MailCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { resendVerificationEmail } from "@/features/feed/feed-api";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";

/** The API's limit (contract §2). */
export const COMMENT_MAX = 1000;

/** Why this person can't comment here, or null when they can. */
export function composerLocked(post: Pick<ApiPost, "neighborhoodId">, profile: { neighborhoodId?: string | null; emailVerified?: boolean } | null | undefined): "follows" | "email" | null {
  // A neighbourhood they only follow: they can read the conversation, not join it (contract §31).
  if (profile?.neighborhoodId && post.neighborhoodId !== profile.neighborhoodId) return "follows";
  if (profile?.emailVerified === false) return "email";
  return null;
}

/** The message in place of the reply box when they can't comment (see composerLocked). */
export function ComposerLock({ post }: { post: Pick<ApiPost, "neighborhoodId"> }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const toast = useToast();
  const why = composerLocked(post, profile);
  if (why === "follows") {
    return (
      <View style={styles.locked}>
        <Text variant="caption" tone="muted" style={styles.flex}>
          You follow this neighbourhood, so you can read along. Comments are for neighbours who live here.
        </Text>
      </View>
    );
  }
  if (why === "email") {
    return (
      <View style={styles.locked}>
        <MailCheck size={20} color={t.colors.primary} />
        <Text variant="caption" style={styles.flex}>
          Confirm your email to join the conversation.
        </Text>
        <Text
          variant="label"
          tone="primary"
          accessibilityRole="button"
          onPress={() => resendVerificationEmail(user).then(() => toast(`New link sent to ${profile?.email ?? user.email ?? "your email"}.`), (err: unknown) => toast(errorMessage(err), "error"))}
        >
          Resend link
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  locked: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH, paddingHorizontal: 4 },
});
