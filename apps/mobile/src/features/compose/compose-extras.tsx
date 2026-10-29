import type { AlertPlace } from "@myhoodora/api-contract/types";
import { ChevronRight, MapPin, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Chip } from "@/shared/ui/chip";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { eventWhen } from "@/features/events/event-time";
import { POLL_LENGTHS, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/features/polls/polls-api";
import type { Draft, DraftErrors } from "./compose-rules";

interface Props {
  draft: Draft;
  errors: DraftErrors | null;
  edit: (patch: Partial<Draft>) => void;
}

const HOUR_MS = 3_600_000;

/** An event's start (an hour's grace, up to a year ahead, as the API allows) and where it is. */
export function EventFields({ draft, errors, edit }: Props) {
  // Read once when the fields appear; the API checks again on posting.
  const [now] = useState(() => Date.now());
  return (
    <View style={styles.group}>
      <DateTimeField
        label="When does it start?"
        value={draft.eventDate}
        onChange={(eventDate) => edit({ eventDate })}
        min={new Date(now - HOUR_MS)}
        max={new Date(now + 365 * 24 * HOUR_MS)}
        error={errors?.eventDate}
        format={(d) => eventWhen(d.toISOString())}
      />
      <TextField
        label="Where? (optional)"
        placeholder="e.g. Community hall, Allen Avenue"
        value={draft.eventLocation}
        onChangeText={(eventLocation) => edit({ eventLocation })}
        maxLength={200}
        error={errors?.eventLocation}
        autoCapitalize="sentences"
      />
    </View>
  );
}

/** A poll's 2–4 choices (add or remove), and how long it stays open. The question is the post text. */
export function PollFields({ draft, errors, edit }: Props) {
  const t = useTheme();
  const options = draft.pollOptions;
  const setOption = (i: number, text: string) => edit({ pollOptions: options.map((o, j) => (j === i ? text : o)) });
  return (
    <View style={styles.group}>
      <Text variant="label">Choices</Text>
      {options.map((o, i) => (
        <View key={i} style={[styles.option, { backgroundColor: t.colors.muted }]}>
          <TextInput
            value={o}
            onChangeText={(text) => setOption(i, text)}
            placeholder={`Choice ${i + 1}${i >= POLL_MIN_OPTIONS ? " (optional)" : ""}`}
            placeholderTextColor={t.colors.mutedForeground}
            maxLength={60}
            accessibilityLabel={`Choice ${i + 1}`}
            style={[styles.optionInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {options.length > POLL_MIN_OPTIONS ? (
            <Pressable onPress={() => edit({ pollOptions: options.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel={`Remove choice ${i + 1}`} hitSlop={8} style={styles.remove}>
              <X size={18} color={t.colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {options.length < POLL_MAX_OPTIONS ? (
        <Pressable onPress={() => edit({ pollOptions: [...options, ""] })} accessibilityRole="button" style={styles.add}>
          <Plus size={18} color={t.colors.primary} />
          <Text variant="label" tone="primary">
            Add a choice
          </Text>
        </Pressable>
      ) : null}
      {errors?.pollOptions ? <InlineAlert>{errors.pollOptions}</InlineAlert> : null}
      <Text variant="label">Open for</Text>
      <View style={styles.chips}>
        {POLL_LENGTHS.map((l) => (
          <Chip key={l.days} label={l.label} selected={draft.pollDays === l.days} onPress={() => edit({ pollDays: l.days })} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  option: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingLeft: 14 },
  optionInput: { flex: 1, minHeight: MIN_TOUCH, fontSize: 16 },
  remove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  add: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: MIN_TOUCH, alignSelf: "flex-start" },
  chips: { flexDirection: "row", gap: 8 },
});

/**
 * An alert's place, optional: "Add the place" opens the map (pin, search or your location); once
 * chosen it shows its name, to change or remove.
 */
export function PlaceRow({ place, ready, onPick, onClear }: { place: AlertPlace | null; ready: boolean; onPick: () => void; onClear: () => void }) {
  const t = useTheme();
  return (
    <View style={[placeStyles.row, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
      <Pressable
        onPress={onPick}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel={place ? `Place: ${place.label ?? "pinned on the map"}. Change it` : "Add the place on a map, optional"}
        style={placeStyles.main}
      >
        <View style={[placeStyles.icon, { backgroundColor: place ? t.colors.dangerSoft : t.colors.muted }]}>
          <MapPin size={18} color={place ? t.colors.destructive : t.colors.mutedForeground} />
        </View>
        <View style={placeStyles.flex}>
          <Text variant="label">{place ? (place.label ?? "Pinned on the map") : "Add the place"}</Text>
          <Text variant="caption" tone="muted">
            {place ? "Tap to change it" : ready ? "Optional. Pin it, or type the street or area" : "Loading the map…"}
          </Text>
        </View>
        {place ? null : <ChevronRight size={18} color={t.colors.mutedForeground} />}
      </Pressable>
      {place ? (
        <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Remove the place" hitSlop={10} style={placeStyles.clear}>
          <X size={18} color={t.colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const placeStyles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingRight: 8 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: MIN_TOUCH },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  clear: { width: MIN_TOUCH - 8, height: MIN_TOUCH - 8, alignItems: "center", justifyContent: "center" },
});
