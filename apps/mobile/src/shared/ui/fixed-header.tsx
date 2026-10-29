import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/shared/theme/theme";
import { ConnectionStrip } from "./connection-strip";
import { GlassSurface } from "./glass-surface";

/**
 * A header fixed to the top while the screen's content scrolls underneath it (through it, in Glass
 * mode). It covers the status bar too, and reports its height so the content can start below it. The
 * connection strip (offline, slow) sits at its foot, so content moves down for it rather than under it.
 */
export function FixedHeader({ children, onHeight, compact = false }: { children: ReactNode; onHeight: (height: number) => void; compact?: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View style={styles.wrap} onLayout={(e) => onHeight(Math.round(e.nativeEvent.layout.height))}>
      <GlassSurface style={[styles.bar, compact && styles.compact, { paddingTop: insets.top + 4, borderBottomColor: t.colors.border }]}>
        {children}
        <ConnectionStrip />
      </GlassSurface>
    </View>
  );
}

/** Before the header has measured itself: the status bar plus a typical bar. */
export function useHeaderEstimate(bar = 56): number {
  return useSafeAreaInsets().top + bar;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0 },
  bar: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  // Header bars with icon buttons at the edges: the buttons carry their own padding.
  compact: { paddingHorizontal: 8, paddingBottom: 4 },
});
