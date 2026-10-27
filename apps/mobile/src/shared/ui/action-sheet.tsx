import type { ComponentType, ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

export interface ActionItem {
  key: string;
  label: string;
  /** A second, quieter line ("Get notified about new comments"). */
  hint?: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  destructive?: boolean;
  /** Shown on the right, e.g. a chevron or "On". */
  trailing?: ReactNode;
}

/**
 * A menu from the bottom with its choices in rounded groups (the "⋯" of a post or an ad): what you can
 * do with it first, then reporting and deleting apart from the rest. Closes on the backdrop, Android
 * back, or a choice; screen readers stay inside while it's open.
 */
export function ActionSheet({ visible, onClose, groups, label }: { visible: boolean; onClose: () => void; groups: ActionItem[][]; label: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: t.colors.background, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal accessibilityLabel={label}>
        <View style={[styles.grabber, { backgroundColor: t.colors.border }]} />
        {groups
          .filter((g) => g.length)
          .map((group, i) => (
            <View key={i} style={[styles.group, { backgroundColor: t.scheme === "dark" ? t.colors.card : t.colors.muted }]}>
              {group.map((item, j) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.hint ? `${item.label}. ${item.hint}` : item.label}
                  style={({ pressed }) => [styles.item, j > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border }, pressed && { backgroundColor: t.colors.accent }]}
                >
                  <item.Icon size={22} color={item.destructive ? t.colors.destructive : t.colors.foreground} />
                  <View style={styles.text}>
                    <Text style={[styles.label, { color: item.destructive ? t.colors.destructive : t.colors.foreground }]}>{item.label}</Text>
                    {item.hint ? (
                      <Text variant="caption" tone="muted">
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  {item.trailing}
                </Pressable>
              ))}
            </View>
          ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 4 },
  group: { borderRadius: 16, overflow: "hidden" },
  item: { minHeight: MIN_TOUCH + 8, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  text: { flex: 1, gap: 1 },
  label: { fontSize: 16, lineHeight: 22 },
});
