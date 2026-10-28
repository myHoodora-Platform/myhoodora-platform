import type { ComponentType } from "react";
import { Pressable, StyleSheet } from "react-native";
import { tint, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/**
 * A rounded choice: feed filters, suggested cities. Selected chips are filled with the brand colour.
 * An `action` chip (a "+ Sell" beside the filters) is tinted instead, so it never reads as a filter.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  Icon,
  action = false,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  Icon?: ComponentType<{ size?: number; color?: string }>;
  action?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const fg = selected ? t.colors.primaryForeground : action ? t.colors.primary : t.colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={action ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.colors.primary : action ? tint(t.colors.primary, 0.1) : t.colors.card,
          borderColor: selected ? t.colors.primary : action ? tint(t.colors.primary, 0.3) : t.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {Icon ? <Icon size={16} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", gap: 6, minHeight: 38, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
