import type { AuthorKind } from "@myhoodora/api-contract/types";
import { BadgeCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { tint, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/**
 * What sits after an author's name: the official Hood Team label, an organisation's check, or a
 * Staff label for myHoodora moderators and admins. Nothing for neighbours (same rule as the web's
 * components/shared/author-badge.tsx).
 */
export function AuthorBadge({ kind, staff }: { kind?: AuthorKind; staff?: boolean }) {
  const t = useTheme();
  if (kind === "team") {
    return (
      <View style={[styles.pill, { backgroundColor: tint(t.colors.primary, 0.12) }]} accessibilityLabel="Official, Hood Team">
        <BadgeCheck size={12} color={t.colors.primary} />
        <Text variant="caption" style={[styles.label, { color: t.colors.primary }]}>
          Official · Hood Team
        </Text>
      </View>
    );
  }
  if (kind === "organisation") return <BadgeCheck size={14} color={t.colors.primary} accessibilityLabel="Official organisation" />;
  if (staff) {
    return (
      <View style={[styles.pill, { backgroundColor: t.colors.muted }]} accessibilityLabel="myHoodora staff">
        <Text variant="caption" tone="muted" style={styles.label}>
          Staff
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, flexShrink: 0 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
});
