import { Image } from "expo-image";
import { useTheme } from "@/shared/theme/theme";

/**
 * The logos the web shows (packages/ui/src/logo.tsx), as images made by scripts/make-assets.cjs from
 * apps/web/public/logo. Never redraw or recolour them here.
 */
const WORDMARK_RATIO = 1381 / 593.967;
const LOCKUP_RATIO = 1316 / 1253;

/**
 * "myHoodora" under its roof: the web's app header and onboarding. Follows the theme; `reversed` forces
 * the version drawn for dark backgrounds (over a photo, whatever the theme).
 */
export function MascotWordmark({ height = 36, reversed = false }: { height?: number; reversed?: boolean }) {
  const t = useTheme();
  return (
    <Image
      source={reversed || t.scheme === "dark" ? require("../../../assets/brand/mascot-wordmark-reversed.png") : require("../../../assets/brand/mascot-wordmark.png")}
      style={{ height, width: height * WORDMARK_RATIO }}
      contentFit="contain"
      accessibilityLabel="myHoodora"
      accessibilityRole="image"
    />
  );
}

/** The mascot with the wordmark: the web's sign-in pages. Too detailed below about 72 pt tall. */
export function MascotLockup({ height = 140 }: { height?: number }) {
  return (
    <Image
      source={require("../../../assets/brand/mascot-lockup-640.webp")}
      style={{ height, width: height * LOCKUP_RATIO, alignSelf: "center" }}
      contentFit="contain"
      accessibilityLabel="myHoodora"
      accessibilityRole="image"
    />
  );
}
