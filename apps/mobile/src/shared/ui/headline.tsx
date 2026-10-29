import type { TextStyle } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** A headline written as "plain **bold** plain": the words in ** ** are set bold. */
export function Headline({ children, size = 34, align = "left", color, accent }: { children: string; size?: number; align?: TextStyle["textAlign"]; color?: string; accent?: string }) {
  const t = useTheme();
  const parts = children.split("**");
  return (
    <Text accessibilityRole="header" style={{ fontFamily: t.fonts.regular, fontSize: size, lineHeight: size * 1.18, textAlign: align, color: color ?? t.colors.foreground }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: t.fonts.bold, fontSize: size, lineHeight: size * 1.18, color: accent ?? color ?? t.colors.foreground }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
