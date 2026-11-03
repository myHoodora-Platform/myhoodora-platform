import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** Photo, or initials on the brand tint (the web's default avatar for neighbours without a photo). */
export function Avatar({ name, photoURL, size = 40 }: { name?: string; photoURL?: string; size?: number }) {
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
});
