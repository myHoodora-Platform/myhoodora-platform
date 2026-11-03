import type { Conversation } from "@myhoodora/api-contract/types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { searchNeighbours } from "@/features/account/account-api";
import { chatKeys, otherPerson } from "./chat-api";

export interface PickedPerson {
  uid: string;
  displayName: string;
  photoURL?: string;
}

function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Choose several neighbours (a new group, or people to add to one): search by name, or pick from
 * people you've talked to lately. The chosen show as chips above; `exclude` (already in the group)
 * can't be chosen. Up to `max`.
 */
export function PeoplePicker({
  picked,
  onChange,
  max,
  exclude = [],
  header,
  paddingBottom = 24,
}: {
  picked: PickedPerson[];
  onChange: (p: PickedPerson[]) => void;
  max: number;
  exclude?: string[];
  header?: React.ReactNode;
  paddingBottom?: number;
}) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const found = useQuery({ queryKey: ["neighbours", q], queryFn: () => searchNeighbours(user, q), enabled: q.length >= 2, placeholderData: keepPreviousData });
  const recent = (client.getQueryData<Conversation[]>(chatKeys.list(false)) ?? [])
    .filter((c) => c.kind !== "group")
    .map((c) => otherPerson(c, user.uid))
    .filter((p, i, all): p is NonNullable<typeof p> => !!p && all.findIndex((x) => x?.uid === p.uid) === i)
    .slice(0, 12)
    .map((p) => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL, line: "You've talked before", verified: false }));
  const searching = q.length >= 2;
  const people = (searching
    ? (found.data ?? []).map((p) => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL, line: p.neighborhoodName, verified: !!p.verified }))
    : recent
  ).filter((p) => p.uid !== user.uid && !exclude.includes(p.uid));
  const isPicked = (uid: string) => picked.some((p) => p.uid === uid);
  const toggle = (p: PickedPerson) => {
    if (isPicked(p.uid)) onChange(picked.filter((x) => x.uid !== p.uid));
    else if (picked.length < max) onChange([...picked, { uid: p.uid, displayName: p.displayName, photoURL: p.photoURL }]);
  };

  return (
    <>
      <View style={styles.top}>
        {header}
        {picked.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {picked.map((p) => (
              <Pressable key={p.uid} onPress={() => toggle(p)} accessibilityRole="button" accessibilityLabel={`Remove ${p.displayName}`} style={[styles.chip, { backgroundColor: tint(t.colors.primary, 0.1) }]}>
                <Avatar name={p.displayName} photoURL={p.photoURL} size={24} />
                <Text variant="caption" numberOfLines={1} style={styles.chipName}>
                  {p.displayName.split(" ")[0]}
                </Text>
                <X size={14} color={t.colors.mutedForeground} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.box, { backgroundColor: t.colors.muted }]}>
          <Search size={18} color={t.colors.mutedForeground} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search neighbours by name"
            placeholderTextColor={t.colors.mutedForeground}
            autoCorrect={false}
            accessibilityLabel="Search neighbours by name"
            style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {found.isFetching ? <ActivityIndicator size="small" color={t.colors.primary} /> : null}
        </View>
        <Text variant="caption" tone="muted" style={styles.section}>
          {picked.length >= max ? `That's the most for one group (${max})` : searching ? "Neighbours" : people.length ? "Recent" : ""}
        </Text>
      </View>
      <FlatList
        data={people}
        keyExtractor={(p) => p.uid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.flex}
        contentContainerStyle={[styles.grow, { paddingBottom }]}
        renderItem={({ item }) => {
          const on = isPicked(item.uid);
          return (
            <Pressable
              onPress={() => toggle(item)}
              disabled={!on && picked.length >= max}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.displayName}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent", opacity: !on && picked.length >= max ? 0.5 : 1 }]}
            >
              <Avatar name={item.displayName} photoURL={item.photoURL} size={44} />
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Text variant="label" numberOfLines={1} style={styles.shrink}>
                    {item.displayName}
                  </Text>
                  {item.verified ? <ShieldCheck size={15} color={t.colors.success} accessibilityLabel="Verified neighbour" /> : null}
                </View>
                {item.line ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {item.line}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.tick, { borderColor: on ? t.colors.primary : t.colors.border, backgroundColor: on ? t.colors.primary : "transparent" }]}>
                {on ? <Check size={14} color={t.colors.primaryForeground} /> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          searching && found.data ? (
            <EmptyState title={`No neighbours called “${q}”`} body="You can add neighbours who accept messages from you." />
          ) : !searching ? (
            <EmptyState title="Who's in it?" body="Type a neighbour's name to find them." />
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  grow: { flexGrow: 1 },
  top: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  chips: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, maxWidth: 160 },
  chipName: { flexShrink: 1 },
  box: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 14, minHeight: MIN_TOUCH },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  section: { textTransform: "uppercase" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: MIN_TOUCH + 16 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
