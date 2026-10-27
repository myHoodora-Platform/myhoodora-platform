import { useState } from "react";
import { StyleSheet, View, type NativeSyntheticEvent, type TextLayoutEventData, type TextStyle } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { collapsedText, expandedPosts, INLINE_EXPAND_LIMIT } from "./see-more";

/**
 * Post text clamped to `lines` with "… See more" at the end of the last line, only when it really
 * overflows. The full text is laid out once, unseen, at the same width; its rendered lines decide.
 * Tapping opens it in place (and it stays open for this post while the feed scrolls), or, for very long
 * text, calls `onOpenPost` instead.
 */
export function SeeMoreText({ id, text, lines, style, onOpenPost }: { id: string; text: string; lines: number; style?: TextStyle; onOpenPost?: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(() => expandedPosts.has(id));
  const [collapsed, setCollapsed] = useState<string | null | undefined>(undefined);
  const measured = (e: NativeSyntheticEvent<TextLayoutEventData>) => setCollapsed(collapsedText(e.nativeEvent.lines.map((l) => l.text), lines));
  const expand = () => {
    if (text.length > INLINE_EXPAND_LIMIT && onOpenPost) return onOpenPost();
    expandedPosts.add(id);
    setOpen(true);
  };
  const seeMore = (
    <Text style={[style, styles.more, { color: t.colors.mutedForeground, fontFamily: t.fonts.semibold }]} onPress={expand} accessibilityRole="button" suppressHighlighting>
      See more
    </Text>
  );

  return (
    <View>
      {/* Laid out in full but not shown or read out: its lines tell us whether to clamp, and where. */}
      {!open ? (
        <Text testID="see-more-measure" style={[style, styles.measure]} onTextLayout={measured} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
          {text}
        </Text>
      ) : null}
      {open || collapsed === null ? (
        <Text style={style} selectable>
          {text}
        </Text>
      ) : collapsed === undefined ? (
        // Before the first layout: clamped by the platform so the card doesn't jump.
        <Text style={style} numberOfLines={lines}>
          {text}
        </Text>
      ) : (
        <Text style={style} accessibilityHint="Double tap See more to read all of it">
          {collapsed}
          {"… "}
          {seeMore}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  more: { textDecorationLine: "none" },
});
