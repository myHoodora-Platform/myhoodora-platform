import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** "Step 2 of 3 · Confirm": a segmented bar, as the web's onboarding shows on phones. */
export function StepProgress({ step, steps }: { step: number; steps: readonly string[] }) {
  const t = useTheme();
  const current = Math.min(Math.max(step, 1), steps.length);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${current} of ${steps.length}: ${steps[current - 1]}`} accessibilityValue={{ min: 1, max: steps.length, now: current }}>
      <View style={styles.bar}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.segment, { backgroundColor: i < current ? t.colors.primary : t.colors.border }]} />
        ))}
      </View>
      <Text variant="caption" tone="muted" style={styles.label}>
        Step {current} of {steps.length} · {steps[current - 1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  label: { marginTop: 8 },
});
