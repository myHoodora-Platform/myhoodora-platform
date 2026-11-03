import { Text as RNText, type TextProps } from "react-native";
import { useTheme } from "@/shared/theme/theme";

type Variant = "title" | "heading" | "body" | "label" | "caption";
type Tone = "default" | "muted" | "primary" | "destructive" | "success" | "inverse";

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
}

/** Outfit at the web's weights: headings 700, labels 600, body 400. */
export function Text({ variant = "body", tone = "default", style, ...rest }: Props) {
  const t = useTheme();
  const color = {
    default: t.colors.foreground,
    muted: t.colors.mutedForeground,
    primary: t.colors.primary,
    destructive: t.colors.destructive,
    success: t.colors.success,
    inverse: t.colors.primaryForeground,
  }[tone];
  const v = {
    title: { fontFamily: t.fonts.bold, fontSize: t.fontSize["2xl"], lineHeight: 30 },
    heading: { fontFamily: t.fonts.bold, fontSize: t.fontSize.lg, lineHeight: 24 },
    body: { fontFamily: t.fonts.regular, fontSize: t.fontSize.base, lineHeight: 22 },
    label: { fontFamily: t.fonts.semibold, fontSize: t.fontSize.sm, lineHeight: 20 },
    caption: { fontFamily: t.fonts.regular, fontSize: t.fontSize.sm, lineHeight: 18 },
  }[variant];
  return <RNText accessibilityRole={variant === "title" || variant === "heading" ? "header" : undefined} style={[v, { color }, style]} {...rest} />;
}
