import type { ReactionType } from "@myhoodora/api-contract/types";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { REACTIONS } from "./reactions";

const SIZE = 48;

/**
 * The six reactions in a row just above the Like button (long-press Like). Tapping your current one
 * takes it back. Closes on any tap outside or Android back.
 */
export function ReactionPicker({ anchor, current, onPick, onClose }: { anchor: { x: number; y: number } | null; current: ReactionType | null; onPick: (type: ReactionType | null) => void; onClose: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  if (!anchor) return null;
  const rowWidth = REACTIONS.length * SIZE + 16;
  const left = Math.max(8, Math.min(anchor.x - 24, width - rowWidth - 8));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close reactions" accessibilityRole="button" />
      <View style={[styles.row, { left, top: Math.max(40, anchor.y - SIZE - 24), backgroundColor: t.colors.card, borderColor: t.colors.border }]} accessibilityRole="menu" accessibilityViewIsModal>
        {REACTIONS.map((r) => {
          const mine = r.id === current;
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                onClose();
                onPick(mine ? null : r.id);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={mine ? `${r.label}, your reaction. Take it back` : r.label}
              style={({ pressed }) => [styles.option, mine && { backgroundColor: t.colors.accent }, pressed && styles.pressed]}
            >
              <Text style={styles.emoji}>{r.emoji}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { position: "absolute", flexDirection: "row", padding: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  option: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 1.25 }] },
  emoji: { fontSize: 28, lineHeight: 34 },
});
