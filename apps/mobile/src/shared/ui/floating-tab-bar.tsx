import type { ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { GlassSurface } from "./glass-surface";
import { Text } from "./text";

export interface TabItem {
  key: string;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  badge?: number;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

/** A round action beside the bar ("Post"). */
export interface TabAction {
  label: string;
  Icon: TabItem["Icon"];
  onPress: () => void;
}

const BAR_HEIGHT = 68;
const GAP_ABOVE = 8;

/** How far a tab's scrolling content must clear at the bottom, so its last item isn't hidden under the bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + BAR_HEIGHT + GAP_ABOVE + 8;
}

/**
 * The tab bar floats over the content (which scrolls on underneath, visible around and through it in
 * Glass mode). What the platform guides ask of a navigation bar stays: a label under every icon, a
 * filled pill behind the current one, 48 pt targets, and unread counts read out.
 */
export function FloatingTabBar({ items, action }: { items: TabItem[]; action?: TabAction }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <GlassSurface radius={BAR_HEIGHT / 2} style={[styles.bar, { borderColor: t.colors.border }, t.scheme === "light" && styles.shadow]}>
        <View accessibilityRole="tablist" style={styles.items}>
          {items.map(({ key, label, Icon, badge, focused, onPress, onLongPress }) => (
            <Pressable
              key={key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
              style={styles.item}
            >
              {/* Always painted (transparent when not current) and never flattened: Android otherwise drew
                  the colour added on focus as a square, ignoring the radius. */}
              <View collapsable={false} style={[styles.pill, { backgroundColor: focused ? t.colors.primary : "transparent" }]}>
                <Icon size={22} color={focused ? t.colors.primaryForeground : t.colors.foreground} />
                {badge ? (
                  <View style={[styles.badge, { backgroundColor: t.colors.destructive, borderColor: t.colors.card }]}>
                    <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" style={[styles.label, { color: focused ? t.colors.primary : t.colors.foreground, fontFamily: focused ? fonts.semibold : fonts.regular }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassSurface>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, { backgroundColor: t.colors.primary, opacity: pressed ? 0.85 : 1 }, styles.shadow]}
        >
          <action.Icon size={22} color={t.colors.primaryForeground} />
          <Text variant="caption" style={[styles.label, { color: t.colors.primaryForeground }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the content, with nothing painted behind the bar itself.
  outer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: GAP_ABOVE, flexDirection: "row", alignItems: "center", gap: 12 },
  bar: { flex: 1, height: BAR_HEIGHT, borderWidth: StyleSheet.hairlineWidth },
  items: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  shadow: { shadowColor: "#0b1716", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  item: { flex: 1, alignItems: "center", gap: 2, minHeight: MIN_TOUCH },
  pill: { width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -3, right: 8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#ffffff", fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
  label: { fontSize: 11, lineHeight: 14 },
  action: { width: BAR_HEIGHT, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, alignItems: "center", justifyContent: "center", gap: 1 },
});
