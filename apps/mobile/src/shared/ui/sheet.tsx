import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "@/shared/hooks/use-keyboard-height";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/**
 * A sheet from the bottom for a short choice (report a post, share) or a short form (ask the team).
 * Closes on the backdrop, the Android back button and "Cancel"; screen readers stay inside it while
 * it's open. With the keyboard open it rides above it, and its content scrolls if the room left is
 * short, so the field being typed in is never hidden.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {visible ? (
        <SheetBody title={title} onClose={onClose} bottom={insets.bottom} top={insets.top}>
          {children}
        </SheetBody>
      ) : null}
    </Modal>
  );
}

/** Inside the modal, so the keyboard is followed in the modal's own window (useKeyboardHeight). */
function SheetBody({ title, onClose, bottom, top, children }: { title: string; onClose: () => void; bottom: number; top: number; children: ReactNode }) {
  const t = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const lift = useAnimatedStyle(() => ({ paddingBottom: Math.max(bottom, keyboardHeight.get()) + 12 }));
  return (
    <View style={[styles.fill, { paddingTop: top + 24 }]}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <Animated.View style={[styles.sheet, { backgroundColor: t.colors.card }, lift]} accessibilityViewIsModal>
        <View style={[styles.grabber, { backgroundColor: t.colors.border }]} />
        <Text variant="heading" style={styles.title}>
          {title}
        </Text>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          {children}
          <SheetItem label="Cancel" onPress={onClose} muted />
        </ScrollView>
      </Animated.View>
    </View>
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
  fill: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  backdrop: { flex: 1 },
  // Never taller than the screen: with the keyboard up, the content scrolls instead.
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12, paddingTop: 8, flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 8 },
  title: { paddingHorizontal: 12, paddingVertical: 8 },
  item: { minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 12 },
  itemText: { fontSize: 16 },
});
