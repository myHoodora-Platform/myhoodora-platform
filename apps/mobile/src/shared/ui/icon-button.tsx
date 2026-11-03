import type { ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fonts, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** A round icon button for headers (bell, messages, back, share), with an optional count. 44 pt target. */
export function IconButton({ Icon, label, onPress, badge, filled = false }: { Icon: ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; badge?: number; filled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={4}
      style={({ pressed }) => [styles.button, { backgroundColor: filled ? t.colors.card : pressed ? t.colors.muted : "transparent" }, filled && styles.shadow]}
    >
      <Icon size={22} color={t.colors.foreground} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: t.colors.destructive, borderColor: t.colors.background }]}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  shadow: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  badge: { position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#ffffff", fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
});
