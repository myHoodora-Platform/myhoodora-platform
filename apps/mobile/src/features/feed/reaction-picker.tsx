import type { ReactionType } from "@myhoodora/api-contract/types";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { REACTIONS } from "./reactions";

const SIZE = 42;
const PAD = 6;
const ROW = REACTIONS.length * SIZE + PAD * 2;

/** Where the row sits for a Like button at (x, y), kept on screen. Shared with the slide gesture so it knows which emoji is under the finger. */
export function pickerLayout(anchor: { x: number; y: number }, screenWidth: number) {
  const left = Math.max(8, Math.min(anchor.x - 24, screenWidth - ROW - 8));
  return { left, top: Math.max(40, anchor.y - SIZE - 36) };
}

/** The reaction under a finger at screen x (y close enough to the row), or null. */
export function reactionAt(x: number, y: number, layout: { left: number; top: number }): number | null {
  if (y < layout.top - 60 || y > layout.top + SIZE + PAD * 2 + 90) return null;
  const i = Math.floor((x - layout.left - PAD) / SIZE);
  return i >= 0 && i < REACTIONS.length ? i : null;
}

/**
 * The six reactions in a row above the Like button. Opens on long-press: slide along it and let go on
 * one to pick it (the one under your finger grows and shows its name), or let go elsewhere and tap
 * one. Tapping your current one takes it back. Closes on a tap outside or Android back.
 */
export function ReactionPicker({
  anchor,
  screenWidth,
  hovered,
  current,
  onPick,
  onClose,
}: {
  anchor: { x: number; y: number } | null;
  screenWidth: number;
  hovered: number | null;
  current: ReactionType | null;
  onPick: (type: ReactionType | null) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  if (!anchor) return null;
  const { left, top } = pickerLayout(anchor, screenWidth);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close reactions" accessibilityRole="button" />
      <View style={[styles.wrap, { left, top }]} pointerEvents="box-none">
        {hovered !== null ? (
          <View style={[styles.label, { left: PAD + hovered * SIZE + SIZE / 2 - 40, backgroundColor: t.colors.foreground }]}>
            <Text variant="caption" style={[styles.labelText, { color: t.colors.background }]} numberOfLines={1}>
              {REACTIONS[hovered]!.label}
            </Text>
          </View>
        ) : null}
        <View style={[styles.row, { backgroundColor: t.colors.card, borderColor: t.colors.border }]} accessibilityRole="menu" accessibilityViewIsModal>
          {REACTIONS.map((r, i) => {
            const mine = r.id === current;
            const big = hovered === i;
            return (
              <Animated.View key={r.id} entering={ZoomIn.delay(i * 25).duration(160)}>
                <Pressable
                  onPress={() => {
                    onClose();
                    onPick(mine ? null : r.id);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={mine ? `${r.label}, your reaction. Take it back` : r.label}
                  style={[styles.option, mine && { backgroundColor: t.colors.accent }, big && styles.big]}
                >
                  <Text style={styles.emoji}>{r.emoji}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        {hovered === null ? (
          <Text variant="caption" tone="muted" style={styles.hint}>
            Tap to choose
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", width: ROW },
  row: { flexDirection: "row", padding: PAD, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  option: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center" },
  big: { transform: [{ scale: 1.3 }, { translateY: -6 }] },
  emoji: { fontSize: 24, lineHeight: 30 },
  label: { position: "absolute", top: -28, width: 80, alignItems: "center", borderRadius: 999, paddingVertical: 2 },
  labelText: { fontSize: 12, lineHeight: 16 },
  hint: { textAlign: "center", marginTop: 6 },
});
