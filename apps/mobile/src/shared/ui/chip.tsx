import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** A rounded choice: feed filters, suggested cities. Selected chips are filled with the brand colour. */
export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.colors.primary : t.colors.card,
          borderColor: selected ? t.colors.primary : t.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="label" style={{ color: selected ? t.colors.primaryForeground : t.colors.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 38, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
