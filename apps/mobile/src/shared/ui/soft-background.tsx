import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/shared/theme/theme";

/** The canvas with two soft brand-tinted glows (teal top, coral bottom), behind intro content. */
export function SoftBackground() {
  const t = useTheme();
  const alpha = t.scheme === "dark" ? 0.22 : 0.14;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.background }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="teal" cx="15%" cy="10%" r="75%">
            <Stop offset="0" stopColor={t.colors.primary} stopOpacity={alpha} />
            <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="coral" cx="90%" cy="95%" r="70%">
            <Stop offset="0" stopColor="#ff6b5b" stopOpacity={alpha * 0.8} />
            <Stop offset="1" stopColor="#ff6b5b" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#teal)" />
        <Rect width="100%" height="100%" fill="url(#coral)" />
      </Svg>
    </View>
  );
}
