import { errorMessage } from "@myhoodora/api-contract/errors";
import { MailCheck, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { PushPrompt } from "@/features/notifications";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { resendVerificationEmail } from "./feed-api";

/** Dismissed for this session only: the web keeps it in sessionStorage. */
let emailBannerDismissed = false;

/** Since October 2026 posting and messaging need a confirmed email (the web's EmailVerificationBanner). */
function EmailBanner({ onDismiss }: { onDismiss: () => void }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const email = profile?.email ?? user.email ?? "your email";
  const resend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail(user);
      toast(`New link sent to ${email}.`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <View style={[styles.banner, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <View style={styles.cardHead}>
        <MailCheck size={20} color={t.colors.primary} />
        <Text variant="label" style={styles.flex}>
          Confirm your email
        </Text>
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}>
          <X size={18} color={t.colors.mutedForeground} />
        </Pressable>
      </View>
      <Text variant="caption" tone="muted">
        {`Confirm it to post and message your neighbours, and so safety alerts reach you. We sent a link to ${email}.`}
      </Text>
      <Button label="Resend link" variant="secondary" onPress={() => void resend()} loading={sending} />
    </View>
  );
}

/**
 * At most one prompt above the feed, most useful first: confirming the email, then notifications.
 * Stacking them would bury the feed under things to dismiss. (A newcomer's welcome is the guided
 * tour now: features/tour.)
 */
export function FeedBanner() {
  const { profile } = useAuth();
  const [emailDismissed, setEmailDismissed] = useState(emailBannerDismissed);

  if (profile?.emailVerified === false && !emailDismissed) {
    return (
      <EmailBanner
        onDismiss={() => {
          emailBannerDismissed = true;
          setEmailDismissed(true);
        }}
      />
    );
  }
  return <PushPrompt />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  banner: { borderRadius: 20, padding: 16, gap: 10, borderWidth: 1 },
});
