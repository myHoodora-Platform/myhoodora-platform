import { CircleAlert, Eye, EyeOff } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  /** A password: hidden, with a button to show it. */
  password?: boolean;
}

/**
 * Labelled, filled input. Following common form guidance: the label stays visible above the field
 * (a placeholder is only an example), the error sits right under it with an icon (never colour
 * alone) and is announced, and the field keeps one fixed height whatever it holds.
 */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, hint, password = false, style, onFocus, onBlur, ...rest }, ref) {
  // One line keeps one fixed height; several lines grow from a taller start.
  const multiline = !!rest.multiline;
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const borderColor = error ? t.colors.destructive : focused ? t.colors.ring : "transparent";
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={[styles.box, multiline && styles.boxMulti, { borderColor, borderRadius: t.radius["2xl"], backgroundColor: t.colors.muted }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={t.colors.mutedForeground}
          secureTextEntry={password && !shown}
          autoCapitalize={password ? "none" : rest.autoCapitalize}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMulti, { color: t.colors.foreground, fontFamily: t.fonts.regular, fontSize: t.fontSize.base }, style]}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setShown((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={shown ? "Hide password" : "Show password"}
            hitSlop={8}
            style={styles.eye}
          >
            {shown ? <EyeOff size={20} color={t.colors.mutedForeground} /> : <Eye size={20} color={t.colors.mutedForeground} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <CircleAlert size={15} color={t.colors.destructive} />
          <Text variant="caption" tone="destructive" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, height: MIN_TOUCH + 8 },
  input: { flex: 1, height: "100%", paddingHorizontal: 16 },
  boxMulti: { height: undefined, minHeight: 112, alignItems: "flex-start" },
  inputMulti: { height: undefined, minHeight: 108, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" },
  eye: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  flex: { flex: 1 },
});
