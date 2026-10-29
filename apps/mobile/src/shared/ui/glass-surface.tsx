import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppearance } from "@/core/preferences/appearance";
import { useReducedTransparency } from "@/shared/hooks/use-reduced-transparency";
import { tint, useTheme } from "@/shared/theme/theme";

/**
 * The background of floating chrome (header, tab bar, Post button). Glass: what scrolls underneath
 * shows through, blurred, on iOS; Android draws a translucent surface (its real blur needs every screen
 * wrapped in a blur target, a cost not worth paying). Plain, or when the phone asks for reduced
 * transparency: a solid surface, always readable.
 */
export function GlassSurface({ children, style, radius = 0, solidColor }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; solidColor?: string }) {
  const t = useTheme();
  const { surface } = useAppearance();
  const reduced = useReducedTransparency();
  const solid = solidColor ?? t.colors.card;
  if (surface === "plain" || reduced || solidColor) {
    return <View style={[{ backgroundColor: solid, borderRadius: radius }, style]}>{children}</View>;
  }
  if (Platform.OS === "ios") {
    return (
      <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
        <BlurView tint={t.scheme === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight"} intensity={80} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  }
  return <View style={[{ backgroundColor: tint(t.colors.card, 0.88), borderRadius: radius }, style]}>{children}</View>;
}
