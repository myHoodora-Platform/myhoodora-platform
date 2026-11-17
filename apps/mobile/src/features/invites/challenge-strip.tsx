import { challengeStrip, lagosToday, TIER_RING } from "@myhoodora/api-contract/engagement";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ChevronRight, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { getEngagement, inviteKeys } from "./invites-api";

const MASCOT = require("../../../assets/images/mascot-256.png");
const hiddenKey = (day: string) => `challenge-strip-hidden:${day}`;

/**
 * A slim line at the top of the feed (the web's too): the launch challenge or your streak, opening
 * Invite neighbours. The × hides it until tomorrow (Lagos time).
 */
export function ChallengeStrip() {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const engagement = useQuery({ queryKey: inviteKeys.engagement(user.uid), queryFn: () => getEngagement(user), staleTime: 5 * 60_000 }).data;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    void AsyncStorage.getItem(hiddenKey(lagosToday())).then((v) => setHidden(v === "1"), () => setHidden(false));
  }, []);
  const strip = challengeStrip(engagement);
  if (!strip || hidden) return null;

  const badge = engagement?.badge;
  const hide = () => {
    setHidden(true);
    void AsyncStorage.setItem(hiddenKey(lagosToday()), "1").catch(() => undefined);
  };

  return (
    <View style={[styles.strip, { backgroundColor: tint(t.colors.primary, 0.08), borderColor: tint(t.colors.primary, 0.3) }]}>
      <Pressable onPress={() => router.push("/invite")} accessibilityRole="button" accessibilityLabel={`${strip.title}. ${strip.detail}. Open Invite neighbours`} style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}>
        {/* The mascot, ringed in your badge's colour once you have one. */}
        <View style={[styles.mascot, badge && { borderColor: TIER_RING[badge.tier ?? "builder"], borderWidth: 2 }]}>
          <Image source={MASCOT} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.text}>
          <Text variant="label" numberOfLines={1}>
            {strip.title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {strip.detail}
          </Text>
        </View>
        <ChevronRight size={18} color={t.colors.primary} />
      </Pressable>
      <Pressable onPress={hide} accessibilityRole="button" accessibilityLabel="Hide until tomorrow" hitSlop={8} style={styles.close}>
        <X size={16} color={t.colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingRight: 4 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH + 4, paddingVertical: 8, paddingLeft: 12 },
  mascot: { width: 34, height: 34, borderRadius: 17, overflow: "hidden", backgroundColor: "#ffffff" },
  image: { width: "100%", height: "100%" },
  text: { flex: 1, minWidth: 0 },
  close: { width: MIN_TOUCH - 8, height: MIN_TOUCH - 8, alignItems: "center", justifyContent: "center" },
});
