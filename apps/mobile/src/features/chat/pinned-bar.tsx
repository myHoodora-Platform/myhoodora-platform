import type { PinnedMessage } from "@myhoodora/api-contract/types";
import { Pin, PinOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { showDialog } from "@/shared/ui/dialog";
import { IconButton } from "@/shared/ui/icon-button";
import { Text } from "@/shared/ui/text";

export const PINNED_BAR_HEIGHT = 56;

/**
 * The chat's pinned messages, under its header (WhatsApp): the newest first. Tapping goes to that
 * message and moves the bar on to the next, so with several it cycles "1 of 3", "2 of 3"…; the
 * marks on the left show which one it's on.
 */
export function PinnedBar({ pins, top, nameOf, onJump, onUnpin }: { pins: PinnedMessage[]; top: number; nameOf: (uid: string) => string; onJump: (messageId: string) => void; onUnpin: (messageId: string) => void }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  if (!pins.length) return null;
  // Pins come and go while the chat is open: wrap rather than point past the end.
  const index = step % pins.length;
  const pin = pins[index]!;
  const what = pin.body || (pin.photo ? "📷 Photo" : "Message");
  const many = pins.length > 1;
  const unpin = () =>
    showDialog("Unpin this message?", "It's unpinned for everyone in the chat.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unpin", onPress: () => onUnpin(pin.messageId) },
    ]);
  return (
    <View style={[styles.bar, { top, backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
      <Pressable
        onPress={() => {
          onJump(pin.messageId);
          setStep(index + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Pinned message${many ? ` ${index + 1} of ${pins.length}` : ""}. ${nameOf(pin.senderUid)}: ${what}`}
        accessibilityHint={many ? "Goes to it, then shows the next pinned message" : "Goes to it"}
        style={({ pressed }) => [styles.main, pressed && { backgroundColor: t.colors.muted }]}
      >
        {many ? (
          <View style={styles.marks} accessible={false}>
            {pins.map((p, i) => (
              <View key={p.messageId} style={[styles.mark, { backgroundColor: i === index ? t.colors.primary : t.colors.border }]} />
            ))}
          </View>
        ) : (
          <Pin size={16} color={t.colors.primary} />
        )}
        <View style={styles.flex}>
          <Text variant="caption" tone="primary">
            {many ? `Pinned message ${index + 1} of ${pins.length}` : "Pinned message"}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            <Text variant="caption" style={{ fontFamily: t.fonts.semibold }}>
              {nameOf(pin.senderUid)}:{" "}
            </Text>
            {what}
          </Text>
        </View>
      </Pressable>
      <IconButton Icon={PinOff} label="Unpin this message" onPress={unpin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { position: "absolute", left: 0, right: 0, height: PINNED_BAR_HEIGHT, flexDirection: "row", alignItems: "center", paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16 },
  marks: { width: 3, height: 36, gap: 2 },
  mark: { flex: 1, borderRadius: 2 },
});
