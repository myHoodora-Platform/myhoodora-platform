import type { Message } from "@myhoodora/api-contract/types";
import { Pressable, StyleSheet, View } from "react-native";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Sheet } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";

/** Who reacted to a message, with what (WhatsApp's reactions list). Your own row takes yours back. */
export function ReactionsSheet({
  message,
  me,
  person,
  onRemoveMine,
  onClose,
}: {
  message: Message | null;
  me: string;
  person: (uid: string) => { name: string; photoURL?: string };
  onRemoveMine: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const rows = (message?.reactions ?? []).flatMap((r) => r.uids.map((uid) => ({ uid, emoji: r.emoji })));
  // You first, as on WhatsApp.
  rows.sort((a, b) => Number(b.uid === me) - Number(a.uid === me));
  return (
    <Sheet visible={!!message} title={`${rows.length} ${rows.length === 1 ? "reaction" : "reactions"}`} onClose={onClose}>
      {rows.map((r) => {
        const mine = r.uid === me;
        const p = person(r.uid);
        return (
          <Pressable
            key={`${r.uid}-${r.emoji}`}
            onPress={
              mine
                ? () => {
                    onRemoveMine();
                    onClose();
                  }
                : undefined
            }
            disabled={!mine}
            accessibilityRole={mine ? "button" : undefined}
            accessibilityLabel={mine ? `Your reaction ${r.emoji}. Tap to remove` : `${p.name} reacted ${r.emoji}`}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
          >
            <Avatar name={p.name} photoURL={p.photoURL} size={36} />
            <View style={styles.flex}>
              <Text variant="label">{mine ? "You" : p.name}</Text>
              {mine ? (
                <Text variant="caption" tone="muted">
                  Tap to remove
                </Text>
              ) : null}
            </View>
            <Text style={styles.emoji}>{r.emoji}</Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: MIN_TOUCH + 8, borderRadius: 12 },
  emoji: { fontSize: 24, lineHeight: 30 },
});
