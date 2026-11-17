import { badgeLabel, TIER_RING, type AvatarBadge } from "@myhoodora/api-contract/engagement";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

const MASCOT = require("../../../assets/images/mascot-256.png");

/**
 * Photo, or initials on the brand tint (the web's default avatar for neighbours without a photo). With
 * `badge`: the participation badge (contract §42), the mascot ringed in the streak tier's colour.
 */
export function Avatar({ name, photoURL, size = 40, badge }: { name?: string; photoURL?: string; size?: number; badge?: AvatarBadge | null }) {
  if (!badge) return <Face name={name} photoURL={photoURL} size={size} />;
  return (
    <View style={{ width: size, height: size }}>
      <Face name={name} photoURL={photoURL} size={size} />
      <ParticipationBadge badge={badge} size={Math.max(14, Math.round(size * 0.42))} style={styles.corner} />
    </View>
  );
}

/** The badge on its own (also on the Invite screen), deliberately unlike a "verified" tick. */
export function ParticipationBadge({ badge, size = 20, style }: { badge: AvatarBadge; size?: number; style?: object }) {
  const t = useTheme();
  const ring = TIER_RING[badge.tier ?? "builder"];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={badgeLabel(badge) ?? "Active neighbour"}
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring, backgroundColor: "#fff", overflow: "hidden", outlineColor: t.colors.card }, style]}
    >
      <Image source={MASCOT} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

function Face({ name, photoURL, size }: { name?: string; photoURL?: string; size: number }) {
  const t = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (photoURL) return <Image source={photoURL} style={[box, { backgroundColor: t.colors.muted }]} accessibilityIgnoresInvertColors />;
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <View style={[box, styles.center, { backgroundColor: t.colors.primary }]} accessible={false}>
      {/* Initials scale with the circle: readable at 32 pt, not lost at 112. */}
      <Text variant="label" tone="inverse" style={{ fontSize: Math.max(12, Math.round(size * 0.38)), lineHeight: Math.round(size * 0.46) }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", right: -3, bottom: -3 },
});
