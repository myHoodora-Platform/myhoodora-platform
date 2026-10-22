import { CloudOff, Hourglass, Wifi } from "lucide-react-native";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useConnectionNotice, type ConnectionNotice } from "@/core/api/connection";
import { tint, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

const COPY: Record<ConnectionNotice, string> = {
  offline: "No internet connection. You're seeing what loaded last.",
  back: "Back online. Refreshing…",
  slow: "Your connection is slow. Still loading…",
};

/**
 * One line under the header about the connection: offline, back online, or slow. Lives in the shared
 * header so every screen says the same thing in the same place, and takes no room when all is well.
 * What's already on screen stays; lists refresh by themselves when the connection returns.
 */
export function ConnectionStrip({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const notice = useConnectionNotice();

  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(COPY[notice]);
  }, [notice]);

  if (!notice) return null;
  const colour = notice === "back" ? t.colors.success : notice === "offline" ? t.colors.foreground : t.colors.warning;
  const Icon = notice === "back" ? Wifi : notice === "offline" ? CloudOff : Hourglass;
  return (
    <View style={[styles.strip, { backgroundColor: tint(colour) }, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon size={14} color={colour} />
      <Text variant="caption" style={[styles.text, { color: t.colors.foreground }]} numberOfLines={2}>
        {COPY[notice]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginHorizontal: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  text: { flexShrink: 1 },
});
