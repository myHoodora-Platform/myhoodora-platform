import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface Props extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

/** The web's Button: rounded-xl, 16×12 padding, 600 weight. Full width by default on mobile. */
export function Button({ label, variant = "primary", loading = false, disabled, style, ...rest }: Props) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.colors.primary, fg: t.colors.primaryForeground, border: t.colors.primary },
    secondary: { bg: t.colors.card, fg: t.colors.foreground, border: t.colors.border },
    ghost: { bg: "transparent", fg: t.colors.primary, border: "transparent" },
    destructive: { bg: t.colors.destructive, fg: t.colors.destructiveForeground, border: t.colors.destructive },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, borderRadius: t.radius.xl, opacity: inactive ? 0.6 : state.pressed ? 0.85 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : <Text variant="label" style={{ color: palette.fg, fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
