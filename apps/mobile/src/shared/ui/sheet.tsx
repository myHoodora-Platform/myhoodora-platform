import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/**
 * A sheet from the bottom for a short choice (report a post, share). Closes on the backdrop, the
 * Android back button and "Cancel"; screen readers stay inside it while it's open.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: t.colors.card, paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
        <View style={[styles.grabber, { backgroundColor: t.colors.border }]} />
        <Text variant="heading" style={styles.title}>
          {title}
        </Text>
        {children}
        <SheetItem label="Cancel" onPress={onClose} muted />
      </View>
    </Modal>
  );
}

export function SheetItem({ label, onPress, destructive = false, muted = false, icon }: { label: string; onPress: () => void; destructive?: boolean; muted?: boolean; icon?: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}>
      {icon}
      <Text variant="label" style={[styles.itemText, { color: destructive ? t.colors.destructive : muted ? t.colors.mutedForeground : t.colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 8 },
  title: { paddingHorizontal: 12, paddingVertical: 8 },
  item: { minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 12 },
  itemText: { fontSize: 16 },
});
