import { ChevronRight } from "lucide-react-native";
import { Children, Fragment, type ComponentType, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { fonts, MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

type IconType = ComponentType<{ size?: number; color?: string }>;

/**
 * Settings, as rows in rounded groups (iOS's inset grouped lists, which Android users know from their
 * own Settings too). Every account and preference screen is built from these, so they all match.
 */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="caption" tone="muted" style={styles.groupTitle} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: t.colors.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" tone="muted" style={styles.groupFooter}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

interface RowProps {
  label: string;
  Icon?: IconType;
  /** Under the label: what it does, or why it's off. */
  description?: string;
  /** On the right, before the chevron: the current choice. */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Replaces the chevron (a switch, a badge). */
  right?: ReactNode;
  /** In place of the icon: an avatar, a thumbnail. */
  leading?: ReactNode;
}

export function SettingsRow({ label, Icon, description, value, onPress, destructive = false, right, leading }: RowProps) {
  const t = useTheme();
  const color = destructive ? t.colors.destructive : t.colors.foreground;
  const body = (
    <>
      {leading}
      {!leading && Icon ? (
        <View style={[styles.icon, { backgroundColor: destructive ? t.colors.dangerSoft : tint(t.colors.primary) }]}>
          <Icon size={18} color={destructive ? t.colors.destructive : t.colors.primary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.label, { color }, leading ? styles.strong : null]}>{label}</Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text tone="muted" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <ChevronRight size={18} color={t.colors.mutedForeground} /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible={!right} accessibilityLabel={value ? `${label}: ${value}` : label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={description}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
    >
      {body}
    </Pressable>
  );
}

/** A row with a switch: the whole row's label names the switch for screen readers. */
export function SettingsSwitch({ label, Icon, description, value, onChange, disabled = false }: { label: string; Icon?: IconType; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <SettingsRow
      label={label}
      Icon={Icon}
      description={description}
      right={<Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} trackColor={{ true: t.colors.primary, false: t.colors.input }} />}
    />
  );
}

/** Two to four choices side by side (Glass · Plain, System · Light · Dark). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.colors.muted }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && [{ backgroundColor: t.colors.card }, styles.segmentOn]]}
          >
            <Text variant="label" style={{ color: on ? t.colors.foreground : t.colors.mutedForeground }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: { paddingHorizontal: 16, letterSpacing: 0.6, fontSize: 12 },
  groupFooter: { paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: MIN_TOUCH + 8 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  strong: { fontFamily: fonts.semibold, fontSize: 17 },
  value: { maxWidth: "45%", textAlign: "right" },
  segmented: { flexDirection: "row", borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentOn: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
