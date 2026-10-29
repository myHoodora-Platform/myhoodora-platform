import { CircleAlert, Info, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

type Tone = "error" | "warning" | "info";

/**
 * A message in the flow of a form or step (the web's ErrorBanner): an icon as well as colour, read out
 * when it appears. Errors interrupt the screen reader; warnings and notes wait their turn.
 */
export function InlineAlert({ tone = "error", children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  const look = {
    error: { bg: t.colors.dangerSoft, fg: t.colors.destructive, Icon: CircleAlert },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning, Icon: TriangleAlert },
    info: { bg: t.colors.muted, fg: t.colors.mutedForeground, Icon: Info },
  }[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: look.bg, borderRadius: t.radius.xl }]}
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
    >
      <look.Icon size={18} color={look.fg} style={styles.icon} />
      <View style={styles.flex}>
        {typeof children === "string" ? <Text variant="caption" style={{ color: t.colors.foreground }}>{children}</Text> : children}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: 10, padding: 12, alignItems: "flex-start" },
  icon: { marginTop: 1 },
  flex: { flex: 1, gap: 6 },
});
