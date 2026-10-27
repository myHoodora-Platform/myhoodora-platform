import { useRouter } from "@/core/navigation/use-router";
import { X } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/core/auth/auth-provider";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { MascotWordmark } from "@/shared/ui/brand";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { StepProgress } from "@/shared/ui/step-progress";
import { Text } from "@/shared/ui/text";
import { ConfirmStep, confirmButton, DetailsStep, FailedStep, JoinedStep, NearbyStep, OutsideStep, RequestedStep, VerifyingStep } from "./onboarding-steps";
import { useOnboarding, type Step } from "./use-onboarding";

const STEPS = ["Your details", "Your neighbourhood", "Join"] as const;
const STEP_NUMBER: Record<Step, number> = { loading: 1, details: 1, confirm: 2, verifying: 3, joined: 3, nearby: 3, requested: 3, outside: 3, failed: 3 };

/**
 * Onboarding, after sign-up (or from the feed's "Finish joining"). The form scrolls under a fixed header
 * and the step's actions stay at the bottom, within thumb reach and above the keyboard.
 */
export function OnboardingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { phase, logout, skipOnboarding } = useAuth();
  const o = useOnboarding();
  const [skipping, setSkipping] = useState(false);
  // Already in the app (opened from the feed): leaving is closing this screen, not skipping onboarding.
  const [openedFromApp] = useState(phase === "ready");

  // Leave once the session has caught up: the refreshed profile (or the skip) has put it in "ready".
  useEffect(() => {
    if ((o.finished || skipping) && phase === "ready") router.replace("/news-feed");
  }, [o.finished, skipping, phase, router]);

  const skip = async () => {
    setSkipping(true);
    await skipOnboarding();
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/news-feed"));
  const early = o.step === "details" || o.step === "confirm";

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <MascotWordmark height={30} />
        {openedFromApp ? (
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={[styles.close, { backgroundColor: t.colors.muted }]}>
            <X size={20} color={t.colors.foreground} />
          </Pressable>
        ) : early ? (
          <Pressable onPress={() => void skip()} disabled={skipping} accessibilityRole="button" accessibilityHint="Browse with limited access and finish later" hitSlop={8} style={styles.skip}>
            <Text variant="label" tone="muted">
              Skip for now
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.progress}>
        <StepProgress step={STEP_NUMBER[o.step]} steps={STEPS} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Body o={o} />
        </ScrollView>
        <Actions o={o} onLogout={() => void logout()} showLogout={!openedFromApp && o.step === "details"} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Body({ o }: { o: ReturnType<typeof useOnboarding> }) {
  switch (o.step) {
    case "loading":
      return (
        <View style={styles.loading} accessible accessibilityLabel="Loading your details" accessibilityState={{ busy: true }}>
          <Skeleton width="75%" height={28} />
          <Skeleton height={16} />
          <Skeleton height={56} radius={16} />
          <Skeleton height={76} radius={16} />
          <Skeleton height={56} radius={16} />
        </View>
      );
    case "details":
      return <DetailsStep o={o} />;
    case "confirm":
      return <ConfirmStep o={o} />;
    case "verifying":
      return <VerifyingStep o={o} />;
    case "joined":
      return <JoinedStep o={o} />;
    case "nearby":
      return <NearbyStep o={o} />;
    case "requested":
      return <RequestedStep o={o} />;
    case "outside":
      return <OutsideStep o={o} />;
    case "failed":
      return <FailedStep o={o} />;
  }
}

/** Each step's buttons: the main action first, full width; the way back under it. */
function Actions({ o, onLogout, showLogout }: { o: ReturnType<typeof useOnboarding>; onLogout: () => void; showLogout: boolean }) {
  const leaving = o.busy === "leaving";
  const footer = (children: ReactNode) => <Footer>{children}</Footer>;
  switch (o.step) {
    case "loading":
    case "verifying":
      return null;
    case "details":
      return footer(
        <>
          <Button label="Continue" onPress={() => void o.toConfirm()} loading={o.busy === "finding"} disabled={o.locate.status === "locating"} />
          {showLogout ? <Button label="Log out" variant="ghost" onPress={onLogout} /> : null}
        </>,
      );
    case "confirm": {
      const main = confirmButton(o);
      return footer(
        <>
          <Button label={main.label} onPress={() => void o.confirm()} disabled={!main.enabled} />
          <Button label="Back" variant="ghost" onPress={o.backToDetails} />
        </>,
      );
    }
    case "joined":
    case "requested":
      return footer(<Button label="Go to my feed" onPress={() => void o.finish()} loading={leaving} />);
    case "nearby": {
      const selected = o.nearby.find((h) => h.id === o.selectedHoodId);
      return footer(
        <>
          <Button label={selected ? `Request to join ${selected.name}` : "Choose a neighbourhood"} onPress={() => void o.requestToJoin()} loading={o.busy === "requesting"} disabled={!selected || leaving} />
          <View style={styles.row}>
            <Button label="Edit address" variant="secondary" onPress={o.backToDetails} disabled={o.busy !== null} style={styles.flex} />
            <Button label="Not now" variant="ghost" onPress={() => void o.finish()} loading={leaving} disabled={o.busy === "requesting"} style={styles.flex} />
          </View>
        </>,
      );
    }
    case "outside":
      return footer(
        <>
          <Button label="Continue to myHoodora" onPress={() => void o.finish()} loading={leaving} />
          <Button label="Edit address" variant="ghost" onPress={o.backToDetails} disabled={leaving} />
        </>,
      );
    case "failed":
      return footer(
        <>
          <Button label="Try again" onPress={() => void o.retryCheck()} disabled={leaving} />
          <View style={styles.row}>
            <Button label="Edit address" variant="secondary" onPress={o.backToDetails} disabled={leaving} style={styles.flex} />
            <Button label="Verify later" variant="ghost" onPress={() => void o.finish()} loading={leaving} style={styles.flex} />
          </View>
        </>,
      );
  }
}

function Footer({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.footer, { borderTopColor: t.colors.border, backgroundColor: t.colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, minHeight: MIN_TOUCH },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  skip: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: 4 },
  progress: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  content: { padding: 20, gap: 18, flexGrow: 1 },
  loading: { gap: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", gap: 8 },
});
