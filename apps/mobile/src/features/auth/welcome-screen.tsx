import { Image } from "expo-image";
import { useRouter } from "@/core/navigation/use-router";
import { StatusBar } from "expo-status-bar";
import { Play } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useAuth } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { MascotWordmark } from "@/shared/ui/brand";
import { Button } from "@/shared/ui/button";
import { Headline } from "@/shared/ui/headline";
import { Text } from "@/shared/ui/text";
import { openWeb } from "@/shared/utils/open-web";
import { takeTurnedAway } from "@/core/age/age-lock";

/** The web hero's accent on its dark photo (apps/web/src/components/marketing/landing.tsx). */
const HERO_ACCENT = "#7fd6cb";
const HERO_INK = "#0b1716";

/** The way in for anyone signed out: the web's hero, on a phone. */
export function WelcomeScreen() {
  const router = useRouter();
  const { replayIntro } = useAuth();
  const insets = useSafeAreaInsets();
  const open = (path: string) => void openWeb(path);
  // Just turned away by the age check (and signed out): say so here, once.
  const [turnedAway] = useState(takeTurnedAway);

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <Image source={require("../../../assets/photos/welcome.webp")} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      {/* Legibility: clear at the top, dark behind the copy, as on the web's hero. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={HERO_INK} stopOpacity={0.15} />
            <Stop offset="0.45" stopColor={HERO_INK} stopOpacity={0.55} />
            <Stop offset="1" stopColor={HERO_INK} stopOpacity={0.96} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#shade)" />
      </Svg>
      <SafeAreaView style={styles.content} edges={["top", "bottom"]}>
        <View style={styles.copy}>
          <MascotWordmark height={56} reversed />
          <Headline size={36} color="#ffffff" accent={HERO_ACCENT}>
            {"Know what's happening **on your street.**"}
          </Headline>
          <Text style={styles.body}>Security alerts, trusted artisans, things for sale and events, from verified neighbours.</Text>
        </View>
        {turnedAway ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Text variant="label" style={styles.noticeTitle}>
              Sorry, you can&apos;t join myHoodora yet
            </Text>
            <Text variant="caption" style={styles.noticeBody}>
              myHoodora is for adults. We&apos;ve closed that account and are deleting everything in it, and we haven&apos;t kept the date of birth.
            </Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button label="Get started" onPress={() => router.push("/register")} />
          <Button label="I already have an account" variant="secondary" onPress={() => router.push("/login")} />
          <Text variant="caption" style={styles.terms}>
            How myHoodora works and uses your data:{" "}
            <Text variant="caption" style={styles.link} onPress={() => open("/terms")} accessibilityRole="link">
              Terms of Use
            </Text>{" "}
            and{" "}
            <Text variant="caption" style={styles.link} onPress={() => open("/privacy")} accessibilityRole="link">
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </SafeAreaView>
      {/* For testers: the intro only shows on a fresh install, so this replays it. Never in production. */}
      {config().appEnv !== "production" ? (
        <Pressable onPress={() => void replayIntro()} accessibilityRole="button" accessibilityLabel="Preview the intro" style={[styles.preview, { top: insets.top + 8 }]} hitSlop={8}>
          <Play size={14} color="#ffffff" fill="#ffffff" />
          <Text variant="label" style={styles.previewText}>
            Preview intro
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: HERO_INK },
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24, gap: 28 },
  preview: { position: "absolute", left: 20, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  previewText: { color: "#ffffff" },
  copy: { gap: 14 },
  body: { color: "rgba(255,255,255,0.85)", fontSize: 17, lineHeight: 24 },
  actions: { gap: 12, paddingBottom: 8 },
  terms: { color: "rgba(255,255,255,0.75)", textAlign: "center" },
  link: { color: HERO_ACCENT },
  notice: { gap: 4, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  noticeTitle: { color: "#ffffff" },
  noticeBody: { color: "rgba(255,255,255,0.85)" },
});
