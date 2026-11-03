import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { useTheme } from "@/shared/theme/theme";

/**
 * A neighbourhood as a tiny map: a few streets, a park and a block, with you as the brand dot in the
 * middle. Drawn, not a map tile, so it costs no data and no map service, and it's ours.
 */
export function HoodMapBadge({ size = 34 }: { size?: number }) {
  const t = useTheme();
  const dark = t.scheme === "dark";
  const land = dark ? "#1f2a28" : "#e7efe9";
  const street = dark ? "#33413e" : "#ffffff";
  const park = dark ? "#244a3a" : "#cfe6d6";
  const block = dark ? "#2a3533" : "#dde6e0";
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessible={false}>
      <Defs>
        <ClipPath id="round">
          <Circle cx="20" cy="20" r="20" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#round)">
        <Rect width="40" height="40" fill={land} />
        <Path d="M-2 26 C 10 22, 18 30, 42 18" stroke={street} strokeWidth="4" fill="none" />
        <Path d="M14 -2 L 22 42" stroke={street} strokeWidth="3" />
        <Path d="M30 -2 L 34 42" stroke={street} strokeWidth="2" />
        <Rect x="0" y="0" width="12" height="14" rx="2" fill={park} />
        <Rect x="24" y="27" width="8" height="9" rx="1.5" fill={block} />
        <Rect x="34" y="4" width="8" height="10" rx="1.5" fill={park} />
        <Circle cx="20" cy="20" r="8" fill={t.colors.primary} opacity={0.18} />
        <Circle cx="20" cy="20" r="4.5" fill={t.colors.primary} stroke="#ffffff" strokeWidth="2" />
      </G>
      <Circle cx="20" cy="20" r="19.5" stroke={dark ? "#33413e" : "#d6e2db"} strokeWidth="1" fill="none" />
    </Svg>
  );
}
