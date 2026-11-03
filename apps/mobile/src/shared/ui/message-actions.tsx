import type { LucideIcon } from "lucide-react-native";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { useTheme } from "@/shared/theme/theme";
import { BubbleBody, type BubbleFrame } from "./chat";
import { Text } from "./text";

/** WhatsApp's six, then ➕ for any emoji. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface MessageAction {
  key: string;
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
}

export interface HeldMessage {
  frame: BubbleFrame;
  mine: boolean;
  body?: string;
  photos?: string[];
  quote?: { who: string; body: string; photo?: boolean; deleted?: boolean };
  /** Your current reaction, ringed in the bar; tapping it again takes it back. */
  myReaction?: string | null;
  /** No reactions on a deleted message. */
  canReact: boolean;
  deleted?: boolean;
  forwarded?: "once" | "many";
}

const BAR_HEIGHT = 52;
const ROW_HEIGHT = 48;
const GAP = 10;
const PANEL_HEIGHT = 320;

/** Where the bar and the menu go: above and below the message, swapped or squeezed near the edges. */
export function menuLayout(frame: BubbleFrame, screen: { height: number }, menuHeight: number, safe: { top: number; bottom: number }) {
  const top = safe.top + 8;
  const bottom = screen.height - safe.bottom - 8;
  // The message itself never needs more than the room left once the bar and menu have theirs.
  const room = bottom - top - BAR_HEIGHT - menuHeight - GAP * 2;
  const height = Math.min(frame.height, Math.max(80, room));
  let y = frame.y;
  if (y - BAR_HEIGHT - GAP < top) y = top + BAR_HEIGHT + GAP;
  if (y + height + GAP + menuHeight > bottom) y = bottom - menuHeight - GAP - height;
  return { barY: y - BAR_HEIGHT - GAP, bubbleY: y, bubbleHeight: height, menuY: y + height + GAP };
}

/**
 * Holding a message (WhatsApp): the screen dims, the message lifts where it was, a bar of quick
 * reactions sits above it (➕ for any emoji) and its actions below. Tap outside or Back to close.
 */
export function MessageActions({ held, actions, onReact, onClose }: { held: HeldMessage | null; actions: MessageAction[]; onReact: (emoji: string | null) => void; onClose: () => void }) {
  return (
    <Modal visible={!!held} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {held ? <Layer held={held} actions={actions} onReact={onReact} onClose={onClose} /> : null}
    </Modal>
  );
}

function Layer({ held, actions, onReact, onClose }: { held: HeldMessage; actions: MessageAction[]; onReact: (emoji: string | null) => void; onClose: () => void }) {
  const t = useTheme();
  const screen = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const menuHeight = actions.length * ROW_HEIGHT + 12;
  const place = menuLayout(held.frame, screen, more ? 0 : menuHeight, { top: safe.top, bottom: more ? safe.bottom + PANEL_HEIGHT : safe.bottom });
  const side = held.mine ? { right: Math.max(8, screen.width - held.frame.x - held.frame.width) } : { left: Math.max(8, held.frame.x) };
  const pick = (emoji: string) => {
    onReact(emoji === held.myReaction ? null : emoji);
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the message menu" />

      {held.canReact ? (
        <Animated.View entering={FadeIn.duration(140)} style={[styles.bar, side, { top: place.barY, backgroundColor: t.colors.card }]} accessibilityRole="toolbar" accessibilityLabel="React">
          {QUICK_REACTIONS.map((e) => (
            <Pressable
              key={e}
              onPress={() => pick(e)}
              accessibilityRole="button"
              accessibilityLabel={held.myReaction === e ? `Remove your ${e} reaction` : `React ${e}`}
              style={[styles.quick, { backgroundColor: held.myReaction === e ? t.colors.muted : "transparent" }]}
            >
              <Text style={styles.quickEmoji}>{e}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setMore(true)} accessibilityRole="button" accessibilityLabel="Choose another emoji" style={[styles.quick, styles.plus, { backgroundColor: t.colors.muted }]}>
            <Plus size={20} color={t.colors.mutedForeground} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* The message, lifted where it was. */}
      <View pointerEvents="none" style={[styles.lifted, side, { top: place.bubbleY, maxHeight: place.bubbleHeight, maxWidth: held.frame.width + 4 }]}>
        <BubbleBody mine={held.mine} body={held.body} photos={held.photos} quote={held.quote} deleted={held.deleted} forwarded={held.forwarded} />
      </View>

      {more ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.panel, { height: PANEL_HEIGHT + safe.bottom, paddingBottom: safe.bottom, backgroundColor: t.colors.card }]}>
          <EmojiKeyboard
            onEmojiSelected={(e) => pick(e.emoji)}
            enableRecentlyUsed
            categoryPosition="bottom"
            disableSafeArea
            emojiSize={30}
            theme={{
              container: t.colors.card,
              header: t.colors.mutedForeground,
              knob: "transparent",
              skinTonesContainer: t.colors.muted,
              category: { icon: t.colors.mutedForeground, iconActive: t.colors.primary, container: t.colors.card, containerActive: t.colors.muted },
              emoji: { selected: t.colors.muted },
            }}
            styles={{ container: { flex: 1, borderRadius: 0, shadowOpacity: 0, elevation: 0 } }}
          />
        </Animated.View>
      ) : actions.length ? (
        <Animated.View entering={FadeIn.duration(160)} style={[styles.menu, side, { top: place.menuY, backgroundColor: t.colors.card }]} accessibilityRole="menu">
          {actions.map((a, i) => (
            <Pressable
              key={a.key}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              accessibilityRole="menuitem"
              style={({ pressed }) => [styles.item, i > 0 && [styles.divider, { borderTopColor: t.colors.border }], { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
            >
              <Text style={[styles.itemLabel, { color: a.destructive ? t.colors.destructive : t.colors.foreground, fontFamily: t.fonts.regular }]}>{a.label}</Text>
              <a.Icon size={20} color={a.destructive ? t.colors.destructive : t.colors.foreground} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const shadow = { elevation: 8, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } } as const;
const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(0,0,0,0.45)" },
  bar: { position: "absolute", height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2, ...shadow },
  quick: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
  plus: { marginLeft: 2 },
  lifted: { position: "absolute", overflow: "hidden", borderRadius: 20, ...shadow },
  menu: { position: "absolute", width: 230, borderRadius: 16, paddingVertical: 6, overflow: "hidden", ...shadow },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, minHeight: ROW_HEIGHT },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  itemLabel: { fontSize: 16 },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
});

