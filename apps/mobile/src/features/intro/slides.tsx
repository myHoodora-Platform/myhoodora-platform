import { Image } from "expo-image";
import { MapPin, ShieldCheck } from "lucide-react-native";
import { StyleSheet, View, type ImageSourcePropType } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";

/**
 * The intro's three slides. Copy from the web's landing page (apps/web/src/components/marketing/landing.tsx);
 * the notifications are the ones its phone mockup shows (phone-app-screen.tsx). Visuals are the web's own:
 * the mascot roof, its app mockups, its photography (scripts/make-assets.cjs).
 */
export interface Slide {
  key: string;
  /** "**bold**" marks the emphasised words. */
  title: string;
  body: string;
  layout: "textTop" | "textBottom" | "centred";
  Visual: () => React.JSX.Element;
}

const img = {
  house: require("../../../assets/brand/mascot-house.png") as ImageSourcePropType,
  feed: require("../../../assets/screens/feed.webp") as ImageSourcePropType,
  recommendation: require("../../../assets/screens/recommendation.webp") as ImageSourcePropType,
  neighbour: require("../../../assets/photos/neighbour.webp") as ImageSourcePropType,
};

const NOTIFICATIONS = [
  { title: "Security alert · Lekki Phase 1", body: "Suspicious movement reported near the Admiralty Way roundabout.", time: "now" },
  { title: "Ngozi Fashola replied", body: "Oga Femi fixed my generator last week, I'll send you his number 👍", time: "2m" },
  { title: "New message about your listing", body: "Is the chest freezer still available? I can pick up after 5pm.", time: "8m" },
];

/** One notification, as the phone would show it. */
function NotificationCard({ title, body, time, style }: { title: string; body: string; time: string; style?: object }) {
  const t = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: t.colors.card, borderColor: t.colors.border }, style]}>
      <View style={[styles.noteIcon, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
        <Image source={img.house} style={styles.noteRoof} contentFit="contain" accessible={false} />
      </View>
      <View style={styles.flex}>
        <View style={styles.noteHead}>
          <Text variant="label" numberOfLines={1} style={styles.flex}>
            {title}
          </Text>
          <Text variant="caption" tone="muted">
            {time}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {body}
        </Text>
      </View>
    </View>
  );
}

/** What a neighbourhood sounds like: three notifications fanned over the faded mascot roof. */
function NotificationsVisual() {
  return (
    <View style={styles.fill} accessible accessibilityLabel="Notifications from neighbours: a security alert, a reply, a message">
      <Image source={img.house} style={styles.bigRoof} contentFit="contain" accessible={false} />
      <View style={styles.stack}>
        {NOTIFICATIONS.map((n, i) => (
          <NotificationCard key={n.title} {...n} style={[styles.noteShadow, { transform: [{ translateX: [-10, 14, -4][i]! }, { rotate: ["-3deg", "2deg", "-1deg"][i]! }], opacity: [1, 0.96, 0.9][i] }]} />
        ))}
      </View>
    </View>
  );
}

/** Two app screens from the web, fanned like cards: the feed in front, a recommendation thread behind. */
function ScreensVisual() {
  return (
    <View style={styles.fill} accessible accessibilityLabel="The myHoodora feed, with alerts and posts from neighbours">
      <Image source={img.recommendation} style={[styles.phone, styles.back]} contentFit="contain" />
      <Image source={img.feed} style={[styles.phone, styles.front]} contentFit="contain" />
    </View>
  );
}

/** A neighbour, fading into the page, with the mascot roof and two notes floating beside her. */
function NeighbourVisual() {
  const t = useTheme();
  return (
    <View style={styles.fill}>
      <View style={styles.photoWrap}>
        <Image source={img.neighbour} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" accessibilityLabel="A smiling neighbour" />
        {/* The photo melts into the background instead of ending at an edge. */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.55" stopColor={t.colors.background} stopOpacity={0} />
              <Stop offset="1" stopColor={t.colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>
      <Image source={img.house} style={styles.badgeRoof} contentFit="contain" accessible={false} />
      <View style={[styles.chip, styles.chipLeft, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <ShieldCheck size={18} color={t.colors.success} />
        <Text variant="label">Verified neighbour</Text>
      </View>
      <View style={[styles.chip, styles.chipRight, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <MapPin size={16} color={t.colors.primary} />
        <Text variant="label">Lekki Phase 1</Text>
      </View>
    </View>
  );
}

export const SLIDES: Slide[] = [
  {
    key: "welcome",
    title: "Your **neighbourhood**,\nconnected.",
    body: "Alerts, recommendations and messages from the people who live around you.",
    layout: "textTop",
    Visual: NotificationsVisual,
  },
  {
    key: "feed",
    title: "**Everything** happening near you, **in one feed**",
    body: "Security alerts, trusted artisans, things for sale and events, from people who live near you.",
    layout: "textBottom",
    Visual: ScreensVisual,
  },
  {
    key: "trust",
    title: "**Verified** neighbours.\n**Real** trust.",
    body: "Everyone confirms where they live. Your address is never shown, and it's free for residents.",
    layout: "centred",
    Visual: NeighbourVisual,
  },
];

const shadow = { shadowColor: "#0b1716", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigRoof: { position: "absolute", width: 560, height: 340, right: -190, bottom: -40, opacity: 0.14 },
  stack: { width: "88%", gap: 14 },
  note: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  noteShadow: shadow,
  noteIcon: { width: 40, height: 40, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  noteRoof: { width: 30, height: 20 },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  phone: { position: "absolute", width: 200, height: 418 },
  back: { transform: [{ translateX: 56 }, { translateY: 14 }, { rotate: "9deg" }], opacity: 0.95 },
  front: { transform: [{ translateX: -40 }, { rotate: "-6deg" }] },
  photoWrap: { width: "86%", height: "100%", borderTopLeftRadius: 140, borderTopRightRadius: 140, overflow: "hidden" },
  badgeRoof: { position: "absolute", width: 92, height: 56, top: "8%", right: "6%" },
  chip: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, ...shadow },
  chipLeft: { top: "38%", left: "4%" },
  chipRight: { top: "58%", right: "4%" },
});
