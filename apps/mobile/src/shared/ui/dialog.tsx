import { useSyncExternalStore } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

/** The same shape as React Native's Alert buttons, so a call site changes in one word. */
export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface Dialog {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let current: Dialog | null = null;
const listeners = new Set<() => void>();
const set = (next: Dialog | null) => {
  current = next;
  listeners.forEach((l) => l());
};

/**
 * Asks the person something in the app's own look (the system's Alert is plain grey on Android and
 * ignores dark mode). Same arguments as `Alert.alert`: a title, a message, buttons with "cancel" and
 * "destructive" styles. With no buttons, a single OK.
 */
export function showDialog(title: string, message?: string, buttons: DialogButton[] = [{ text: "OK" }]): void {
  set({ title, message, buttons });
}

/** Mounted once at the root (app/_layout.tsx), above every screen and sheet. */
export function DialogHost() {
  const dialog = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const cancel = dialog?.buttons.find((b) => b.style === "cancel");
  const close = (b?: DialogButton) => {
    set(null);
    // After it has gone, so a follow-up dialog or screen isn't swallowed by this one closing.
    if (b?.onPress) setTimeout(b.onPress, 0);
  };
  return (
    <Modal visible={!!dialog} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close(cancel)}>
      {dialog ? <Card dialog={dialog} onPress={close} onDismiss={() => close(cancel)} /> : null}
    </Modal>
  );
}

function Card({ dialog, onPress, onDismiss }: { dialog: Dialog; onPress: (b: DialogButton) => void; onDismiss: () => void }) {
  const t = useTheme();
  // Two buttons sit side by side, cancel first; three or more stack, the way Material does.
  const stacked = dialog.buttons.length > 2 || dialog.buttons.some((b) => b.text.length > 18);
  const ordered = stacked ? dialog.buttons : [...dialog.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  return (
    <Animated.View entering={FadeIn.duration(120)} style={[StyleSheet.absoluteFill, styles.center]}>
      <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View entering={FadeIn.duration(160)} style={[styles.card, { backgroundColor: t.colors.card }]} accessibilityViewIsModal accessibilityRole="alert">
        <Text variant="heading">{dialog.title}</Text>
        {dialog.message ? <Text tone="muted">{dialog.message}</Text> : null}
        <View style={[styles.buttons, stacked && styles.stacked]}>
          {ordered.map((b) => {
            const color = b.style === "destructive" ? t.colors.destructive : b.style === "cancel" ? t.colors.mutedForeground : t.colors.primary;
            return (
              <Pressable
                key={b.text}
                onPress={() => onPress(b)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, stacked && styles.buttonStacked, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
              >
                <Text variant="label" style={{ color }}>
                  {b.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  dim: { backgroundColor: "rgba(0,0,0,0.45)" },
  card: { width: "100%", maxWidth: 400, borderRadius: 24, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 12, gap: 10, elevation: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 6 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  button: { minHeight: MIN_TOUCH, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonStacked: { alignItems: "flex-end" },
});
