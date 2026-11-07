import { shouldAskAnalytics } from "@myhoodora/api-contract/app-config";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/core/analytics/analytics";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { readFirstRun } from "@/core/onboarding/first-run";
import { useTour } from "@/features/tour/tour-provider";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { openWeb } from "@/shared/utils/open-web";
import { accountKeys, getAppConfig } from "./account-api";

/**
 * Asks once, on the feed, whether this phone may send usage analytics (core/analytics): opt-in, with
 * "No thanks" exactly as prominent as yes, and nothing sent until they choose. Waits until the
 * first-run tour is over, so a newcomer isn't asked two things at once. Settings → Privacy changes it.
 *
 * After a no it comes back once the days admins set have passed (Admin → Settings → Platform, 180 by
 * default), and for everyone when the privacy policy changes analytics (shouldAskAnalytics). Until the
 * setting has loaded, a no stays a no.
 */
export function AnalyticsConsentCard() {
  const t = useTheme();
  const user = useSignedInUser();
  const uid = user.uid;
  const { loaded, consent } = useAnalyticsConsent();
  const config = useQuery({ queryKey: accountKeys.appConfig, queryFn: () => getAppConfig(user), staleTime: 60 * 60 * 1000 });
  const { running } = useTour();
  const [tourOwed, setTourOwed] = useState(true);
  useEffect(() => {
    if (running) return;
    let cancelled = false;
    void readFirstRun(uid).then((status) => {
      if (!cancelled) setTourOwed(status === "pending");
    });
    return () => {
      cancelled = true;
    };
  }, [uid, running]);

  const ask = loaded && shouldAskAnalytics(consent, config.data?.analytics.reaskDays ?? 0, new Date());
  if (!ask || running || tourOwed) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Text variant="label">Help improve myHoodora?</Text>
      <Text variant="caption" tone="muted">
        Share which features you use, never your name or posts.{" "}
        <Text variant="caption" tone="primary" onPress={() => void openWeb("/privacy#how-we-use-it")} accessibilityRole="link">
          Learn more
        </Text>
      </Text>
      <View style={styles.actions}>
        <Button label="No thanks" variant="secondary" onPress={() => void setAnalyticsConsent("denied")} style={styles.action} />
        <Button label="Yes, I'll help" variant="secondary" onPress={() => void setAnalyticsConsent("granted")} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  action: { flex: 1 },
});
