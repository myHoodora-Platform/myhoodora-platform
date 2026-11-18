import { countdownParts, SEASON_PALETTES } from "@myhoodora/api-contract/seasons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { ImagePlus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { FestiveMascot } from "./festive-mascot";
import { useSeason } from "./use-season";

const pad = (n: number) => String(n).padStart(2, "0");
const closedKey = (key: string) => `season.greeting.${key}`;

/** The season's card at the top of the feed (the web's SeasonGreeting): greeting, countdown, picture, a nudge to post. */
export function SeasonGreeting() {
  const t = useTheme();
  const router = useRouter();
  const { season } = useSeason();
  const [closed, setClosed] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!season) return;
    void AsyncStorage.getItem(closedKey(season.key)).then((v) => setClosed(v === "1"), () => setClosed(false));
  }, [season]);
  useEffect(() => {
    if (!season?.countdownTo) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [season?.countdownTo]);

  const counting = countdownParts(season?.countdownTo, now);
  if (!season || closed || (!season.greeting && !season.image && !counting)) return null;
  const close = () => {
    setClosed(true);
    void AsyncStorage.setItem(closedKey(season.key), "1").catch(() => undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]} accessibilityRole="summary">
      {/* A ribbon in the season's colours: festive, where a coloured outline (red at Christmas) read as an error. */}
      <View style={styles.ribbon}>
        {SEASON_PALETTES[season.accent].map((c, i) => (
          <View key={i} style={[styles.ribbonPart, { backgroundColor: c }]} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.mascot}>
          <FestiveMascot hat={season.mascot} size={52} />
        </View>
        <View style={styles.flex}>
          {season.greeting?.title ? <Text variant="heading">{season.greeting.title}</Text> : null}
          {season.greeting?.body ? (
            <Text tone="muted" style={styles.body}>
              {season.greeting.body}
            </Text>
          ) : null}
          {counting ? (
            <Text style={[styles.count, { fontFamily: t.fonts.bold }]} accessibilityLabel={`${counting.hours} hours ${counting.minutes} minutes to midnight`}>
              {pad(counting.hours)}:{pad(counting.minutes)}:{pad(counting.seconds)}
              <Text variant="caption" tone="muted">
                {"  "}to midnight
              </Text>
            </Text>
          ) : null}
          <Pressable onPress={() => router.push("/compose")} accessibilityRole="button" hitSlop={8} style={styles.cta}>
            <ImagePlus size={16} color={t.colors.primary} />
            <Text variant="label" tone="primary">
              Share a festive moment
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close the greeting" hitSlop={10} style={styles.close}>
          <X size={18} color={t.colors.mutedForeground} />
        </Pressable>
      </View>
      {season.image ? (
        <View>
          <Image source={{ uri: season.image.url }} style={styles.image} contentFit="contain" autoplay accessibilityIgnoresInvertColors />
          {season.image.credit ? (
            <Text variant="caption" tone="muted" style={styles.credit}>
              {season.image.credit}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, paddingTop: 18, gap: 10, overflow: "hidden" },
  ribbon: { position: "absolute", top: 0, left: 0, right: 0, height: 4, flexDirection: "row" },
  ribbonPart: { flex: 1 },
  row: { flexDirection: "row", gap: 12 },
  mascot: { paddingTop: 10 },
  flex: { flex: 1, gap: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  count: { fontSize: 24, lineHeight: 32, marginTop: 4 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, minHeight: MIN_TOUCH - 12 },
  close: { width: MIN_TOUCH - 12, height: MIN_TOUCH - 12, alignItems: "center", justifyContent: "center", marginTop: -6, marginRight: -6 },
  image: { width: "100%", height: 180, borderRadius: 12 },
  credit: { textAlign: "right", fontSize: 11, marginTop: 2 },
});
