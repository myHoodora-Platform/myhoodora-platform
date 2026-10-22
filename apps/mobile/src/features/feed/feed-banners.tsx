import { errorMessage } from "@myhoodora/api-contract/errors";
import { Bell, MailCheck, MessageCircle, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useState, type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { readFirstRun, writeFirstRun } from "@/core/onboarding/first-run";
import { PushPrompt } from "@/features/notifications";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { resendVerificationEmail } from "./feed-api";

type IconType = ComponentType<{ size?: number; color?: string }>;

const TIPS: { Icon: IconType; title: string; body: string }[] = [
  { Icon: SlidersHorizontal, title: "Jump to what matters", body: "Use the filters above for alerts, recommendations or things for sale." },
  { Icon: MessageCircle, title: "Join the conversation", body: "Tap a post to read the comments. Like it to let a neighbour know it helped." },
  { Icon: Bell, title: "Hear about urgent alerts", body: "Notifications tell you when neighbours post a safety alert or reply to you." },
];

/** The once-only welcome for a newcomer (the web's first-run tour, as a card: no overlay, never in the way). */
function WelcomeCard({ hoodName, onClose }: { hoodName?: string; onClose: (how: "completed" | "skipped") => void }) {
  const t = useTheme();
  const { profile } = useAuth();
  const first = profile?.displayName?.split(/\s+/)[0];
  return (
    <View style={[styles.card, { backgroundColor: t.colors.primary }]} accessibilityRole="summary">
      <View style={styles.cardHead}>
        <Text variant="heading" style={[styles.flex, { color: t.colors.primaryForeground }]}>
          {`Welcome${first ? `, ${first}` : ""}! You're in ${hoodName ?? "your neighbourhood"}.`}
        </Text>
        <Pressable onPress={() => onClose("skipped")} accessibilityRole="button" accessibilityLabel="Dismiss the welcome" hitSlop={10} style={styles.close}>
          <X size={18} color={t.colors.primaryForeground} />
        </Pressable>
      </View>
      {TIPS.map(({ Icon, title, body }) => (
        <View key={title} style={styles.tip}>
          <View style={styles.tipIcon}>
            <Icon size={18} color={t.colors.primaryForeground} />
          </View>
          <View style={styles.flex}>
            <Text variant="label" style={{ color: t.colors.primaryForeground }}>
              {title}
            </Text>
            <Text variant="caption" style={{ color: t.colors.primaryForeground, opacity: 0.9 }}>
              {body}
            </Text>
          </View>
        </View>
      ))}
      <Button label="Got it" variant="secondary" onPress={() => onClose("completed")} />
    </View>
  );
}

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
 * At most one prompt above the feed, most useful first: the newcomer's welcome, then confirming the
 * email, then notifications. Stacking them would bury the feed under things to dismiss.
 */
export function FeedBanner({ hoodName }: { hoodName?: string }) {
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [firstRun, setFirstRun] = useState<"loading" | "show" | "hide">("loading");
  const [emailDismissed, setEmailDismissed] = useState(emailBannerDismissed);

  useEffect(() => {
    let alive = true;
    void readFirstRun(user.uid).then((s) => alive && setFirstRun(s === "pending" ? "show" : "hide"));
    return () => {
      alive = false;
    };
  }, [user.uid]);

  if (firstRun === "loading") return null;
  if (firstRun === "show") {
    return (
      <WelcomeCard
        hoodName={hoodName}
        onClose={(how) => {
          setFirstRun("hide");
          void writeFirstRun(user.uid, how);
        }}
      />
    );
  }
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
  card: { borderRadius: 24, padding: 18, gap: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  tip: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tipIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  banner: { borderRadius: 20, padding: 16, gap: 10, borderWidth: 1 },
});
