import { dark, fontSize, light, radius, space, type ColorTokens } from "@myhoodora/design-tokens";
import { createContext, useContext } from "react";
import { Appearance } from "react-native";

/** Outfit, loaded in the root layout (@expo-google-fonts/outfit). */
export const fonts = {
  regular: "Outfit_400Regular",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
} as const;

export interface Theme {
  scheme: "light" | "dark";
  colors: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fonts: typeof fonts;
}

export function themeFor(scheme: "light" | "dark"): Theme {
  return { scheme, colors: scheme === "dark" ? dark : light, space, radius, fontSize, fonts };
}

/**
 * The scheme every screen draws with, resolved once by AppearanceProvider (the person's choice, or
 * the phone's when they chose System). One React value, so a switch repaints everything in the same
 * frame: reading React Native's useColorScheme in each component instead left Android half light,
 * half dark for seconds while the native night-mode change reached each one in turn.
 */
export const ColorSchemeContext = createContext<"light" | "dark" | null>(null);

export function useTheme(): Theme {
  // Outside the provider (tests, the config-problem screen): whatever the phone says now.
  const scheme = useContext(ColorSchemeContext) ?? (Appearance.getColorScheme() === "dark" ? "dark" : "light");
  return themeFor(scheme);
}

/** Smallest comfortable touch target (iOS 44 pt, Android 48 dp). */
export const MIN_TOUCH = 48;

/** A colour token at low opacity ("#11706a" → "#11706a1a"): soft brand tints the shared tokens don't name. */
export function tint(hex: string, alpha = 0.1): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}
