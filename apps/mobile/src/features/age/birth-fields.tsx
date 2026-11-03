import { needsFullDate, readBirthInput, spokenBirthAnswer } from "@myhoodora/api-contract/age";
import { useRef } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";

export interface BirthInput {
  year: string;
  month: string;
  day: string;
}

export const EMPTY_BIRTH: BirthInput = { year: "", month: "", day: "" };

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

interface Props {
  value: BirthInput;
  onChange: (next: BirthInput) => void;
  problem?: string | null;
  onSubmitEditing?: () => void;
}

/**
 * The age check's question (docs/compliance/ndpa.md §1), year first, as on the web: a blank year with
 * no hint of the minimum age. The day and month appear only for the one year the year alone can't
 * settle. A complete answer is read back underneath, because it can't be changed later.
 */
export function BirthFields({ value, onChange, problem, onSubmitEditing }: Props) {
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const askDate = value.year.length === 4 && needsFullDate(Number(value.year));
  const read = readBirthInput(askDate ? value : { year: value.year });
  const note = read.ok
    ? `Born ${read.value.length === 4 ? "in" : "on"} ${spokenBirthAnswer(read.value)}. You won't be able to change this later.`
    : askDate
      ? "And the day and month, please."
      : "We use it once to check you can join, then throw it away.";

  return (
    <View style={styles.wrap}>
      <TextField
        label="Year you were born"
        placeholder="YYYY"
        value={value.year}
        onChangeText={(v) => {
          const year = digits(v, 4);
          onChange({ ...value, year });
          if (year.length === 4 && needsFullDate(Number(year))) dayRef.current?.focus();
        }}
        keyboardType="number-pad"
        autoComplete="birthdate-year"
        returnKeyType={askDate ? "next" : "done"}
        onSubmitEditing={askDate ? () => dayRef.current?.focus() : onSubmitEditing}
        maxLength={4}
        error={askDate ? null : (problem ?? null)}
      />
      {askDate ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              ref={dayRef}
              label="Day"
              placeholder="DD"
              value={value.day}
              onChangeText={(v) => {
                const day = digits(v, 2);
                onChange({ ...value, day });
                if (day.length === 2) monthRef.current?.focus();
              }}
              keyboardType="number-pad"
              autoComplete="birthdate-day"
              returnKeyType="next"
              maxLength={2}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              ref={monthRef}
              label="Month"
              placeholder="MM"
              value={value.month}
              onChangeText={(v) => onChange({ ...value, month: digits(v, 2) })}
              keyboardType="number-pad"
              autoComplete="birthdate-month"
              returnKeyType="done"
              onSubmitEditing={onSubmitEditing}
              maxLength={2}
            />
          </View>
        </View>
      ) : null}
      {!problem ? (
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      ) : askDate ? (
        <Text variant="caption" tone="destructive">
          {problem}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
