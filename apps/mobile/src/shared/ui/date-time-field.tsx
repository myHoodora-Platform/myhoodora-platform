import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { atTime, monthGrid, sameDay, startOfDay, WEEKDAYS } from "@/shared/utils/calendar";
import { Button } from "./button";
import { InlineAlert } from "./inline-alert";
import { Text } from "./text";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];

/**
 * A date and time, picked in a sheet: a month calendar (days outside `min`–`max` can't be chosen),
 * then the hour, minutes and am/pm. Built in the app, so it looks the same on every phone and
 * needs no native module.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  min,
  max,
  error,
  placeholder = "Choose a date and time",
  format,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  min: Date;
  max: Date;
  error?: string;
  placeholder?: string;
  format: (d: Date) => string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? format(value) : "not chosen"}`}
        style={[styles.input, { backgroundColor: t.colors.muted, borderColor: error ? t.colors.destructive : "transparent" }]}
      >
        <CalendarClock size={20} color={value ? t.colors.primary : t.colors.mutedForeground} />
        <Text style={{ color: value ? t.colors.foreground : t.colors.mutedForeground }}>{value ? format(value) : placeholder}</Text>
      </Pressable>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {open ? <PickerSheet initial={value} min={min} max={max} onClose={() => setOpen(false)} onDone={(d) => (onChange(d), setOpen(false))} format={format} /> : null}
    </View>
  );
}

function PickerSheet({ initial, min, max, onClose, onDone, format }: { initial: Date | null; min: Date; max: Date; onClose: () => void; onDone: (d: Date) => void; format: (d: Date) => string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Start on the chosen day, or tomorrow at 10 am: a sensible first guess for a neighbourhood event.
  const [seed] = useState(() => initial ?? atTime(new Date(Date.now() + 86_400_000), 10, 0));
  const [day, setDay] = useState(startOfDay(seed));
  const [shown, setShown] = useState({ year: seed.getFullYear(), month: seed.getMonth() });
  const [hour12, setHour12] = useState(seed.getHours() % 12 || 12);
  const [minute, setMinute] = useState(MINUTES.reduce((a, b) => (Math.abs(b - seed.getMinutes()) < Math.abs(a - seed.getMinutes()) ? b : a)));
  const [pm, setPm] = useState(seed.getHours() >= 12);
  const chosen = atTime(day, (hour12 % 12) + (pm ? 12 : 0), minute);
  const tooEarly = chosen < min;
  const firstDay = startOfDay(min);
  const lastDay = startOfDay(max);
  const monthStart = new Date(shown.year, shown.month, 1);
  const canBack = monthStart > new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
  const canNext = new Date(shown.year, shown.month + 1, 1) <= lastDay;
  const move = (by: number) => setShown(({ year, month }) => ({ year: year + Math.floor((month + by) / 12), month: (((month + by) % 12) + 12) % 12 }));
  const today = new Date();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: t.colors.card, paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
        <View style={[styles.grabber, { backgroundColor: t.colors.border }]} />
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => canBack && move(-1)} disabled={!canBack} accessibilityRole="button" accessibilityLabel="Previous month" style={[styles.nav, !canBack && styles.off]}>
              <ChevronLeft size={22} color={t.colors.foreground} />
            </Pressable>
            <Text variant="heading" accessibilityRole="header">
              {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </Text>
            <Pressable onPress={() => canNext && move(1)} disabled={!canNext} accessibilityRole="button" accessibilityLabel="Next month" style={[styles.nav, !canNext && styles.off]}>
              <ChevronRight size={22} color={t.colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((w) => (
              <Text key={w} variant="caption" tone="muted" style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>
          {/* Weeks wholly before the first allowed day are left out. */}
          {monthGrid(shown.year, shown.month).filter((week) => week.some((d) => d && d >= firstDay)).map((week, i) => (
            <View key={i} style={styles.week}>
              {week.map((d, j) => {
                if (!d) return <View key={j} style={styles.cell} />;
                const off = d < firstDay || d > lastDay;
                const on = sameDay(d, day);
                const isToday = sameDay(d, today);
                return (
                  <Pressable
                    key={j}
                    onPress={() => setDay(d)}
                    disabled={off}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: off }}
                    accessibilityLabel={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    style={styles.cell}
                  >
                    {/* Always painted and never flattened, or Android draws the selected colour square (as in the tab bar). */}
                    <View collapsable={false} style={[styles.dayDot, { backgroundColor: on ? t.colors.primary : "transparent", borderColor: !on && isToday ? t.colors.primary : "transparent" }]}>
                      <Text style={{ color: on ? t.colors.primaryForeground : off ? t.colors.border : t.colors.foreground, fontFamily: on || isToday ? t.fonts.semibold : t.fonts.regular }}>{d.getDate()}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Text variant="label" style={styles.timeLabel}>
            Time
          </Text>
          {/* All twelve hours in two rows: nothing hidden off the edge. */}
          <View style={styles.hours}>
            {HOURS.map((h) => (
              <View key={h} style={styles.hourCell}>
                <Choice label={String(h)} on={h === hour12} onPress={() => setHour12(h)} a11y={`${h} o'clock`} />
              </View>
            ))}
          </View>
          <View style={styles.timeRow}>
            <View style={styles.chips}>
              {MINUTES.map((m) => (
                <Choice key={m} label={`:${String(m).padStart(2, "0")}`} on={m === minute} onPress={() => setMinute(m)} a11y={`${m} minutes`} />
              ))}
            </View>
            <View style={[styles.ampm, { backgroundColor: t.colors.muted }]}>
              {(["am", "pm"] as const).map((x) => {
                const on = (x === "pm") === pm;
                return (
                  <Pressable key={x} onPress={() => setPm(x === "pm")} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.ampmItem, on && { backgroundColor: t.colors.card }]}>
                    <Text variant="label" style={{ color: on ? t.colors.foreground : t.colors.mutedForeground }}>
                      {x}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {tooEarly ? <InlineAlert>That time has already passed. Choose a later one.</InlineAlert> : null}
          <Button label={tooEarly ? "Choose a later time" : `Done · ${format(chosen)}`} onPress={() => onDone(chosen)} disabled={tooEarly} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Choice({ label, on, onPress, a11y }: { label: string; on: boolean; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y}
      style={[styles.choice, { backgroundColor: on ? t.colors.primary : tint(t.colors.foreground, 0.05) }]}
    >
      <Text variant="label" style={{ color: on ? t.colors.primaryForeground : t.colors.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  input: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%" },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginVertical: 10 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  nav: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.3 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 2 },
  dayDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  timeLabel: { marginTop: 12 },
  chips: { flexDirection: "row", gap: 6 },
  hours: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  hourCell: { width: "16.66%", paddingHorizontal: 3 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginVertical: 6 },
  choice: { minWidth: 44, minHeight: 40, paddingHorizontal: 10, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ampm: { flexDirection: "row", padding: 3, borderRadius: 12 },
  ampmItem: { minWidth: 44, minHeight: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
