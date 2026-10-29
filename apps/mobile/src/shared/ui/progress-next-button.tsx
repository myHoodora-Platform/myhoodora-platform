import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/shared/theme/theme";

const SIZE = 72;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** A round "next" button whose ring fills as the person moves through the steps (`progress` 0–1). */
export function ProgressNextButton({ progress, onPress, label }: { progress: number; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.colors.border} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={t.colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={[styles.inner, { backgroundColor: t.colors.primary }]}>
        <ArrowRight size={24} color={t.colors.primaryForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { width: SIZE - 16, height: SIZE - 16, borderRadius: (SIZE - 16) / 2, margin: 8, alignItems: "center", justifyContent: "center" },
});
