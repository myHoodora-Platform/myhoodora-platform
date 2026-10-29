import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { useReducedMotion } from "@/shared/hooks/use-reduced-motion";
import { useTheme } from "@/shared/theme/theme";
import { MascotLockup } from "./brand";
import { SoftBackground } from "./soft-background";
import { Text } from "./text";

/**
 * A whole screen while something that matters is happening and nothing else can be shown yet (the
 * account being set up after sign-up). The mascot breathes gently, never faster than the work: no fake
 * progress, and still when the phone asks for reduced motion. Short waits use a button's own spinner.
 */
export function BrandedLoading({ message }: { message: string }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [reduced, scale]);

  return (
    <View style={styles.fill} accessible accessibilityRole="progressbar" accessibilityLabel={message} accessibilityState={{ busy: true }}>
      <SoftBackground />
      <Animated.View style={{ transform: [{ scale }] }}>
        <MascotLockup height={150} />
      </Animated.View>
      <View style={styles.status}>
        <ActivityIndicator color={t.colors.primary} />
        <Text variant="label" tone="muted">
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 32, padding: 24 },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
});
