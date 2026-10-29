import { useEffect, useState } from "react";
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import { useReducedMotion } from "@/shared/hooks/use-reduced-motion";
import { useTheme } from "@/shared/theme/theme";

/**
 * A grey block standing in for content whose shape is known (NN/g: skeletons for page loads under
 * about 10 s). It pulses gently, and holds still when the phone asks for reduced motion.
 */
export function Skeleton({ width = "100%", height = 14, radius, style }: { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: ViewStyle }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduced, opacity]);

  return <Animated.View style={[{ width, height, borderRadius: radius ?? t.radius.md, backgroundColor: t.colors.muted, opacity }, style]} />;
}

/** The shape of a post card while the feed loads: face, name, three lines of text, a photo edge to edge. */
export function PostSkeleton() {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }]}>
      <View style={[styles.row, styles.inset]}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.lines}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
      <View style={[styles.inset, styles.text]}>
        <Skeleton height={14} />
        <Skeleton width="85%" height={14} />
        <Skeleton width="60%" height={14} />
      </View>
      <Skeleton height={220} radius={0} />
      <View style={[styles.row, styles.inset, styles.bar]}>
        <Skeleton width="25%" height={14} />
        <Skeleton width="25%" height={14} />
        <Skeleton width="25%" height={14} />
      </View>
    </View>
  );
}

/** Several post shapes, announced once as loading. */
export function FeedSkeleton({ label = "Loading posts" }: { label?: string }) {
  return (
    <View style={styles.list} accessible accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <PostSkeleton />
      <PostSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12, gap: 12 },
  inset: { paddingHorizontal: 16 },
  text: { gap: 8 },
  bar: { justifyContent: "space-around" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  lines: { flex: 1, gap: 6 },
  list: { gap: 8 },
});
