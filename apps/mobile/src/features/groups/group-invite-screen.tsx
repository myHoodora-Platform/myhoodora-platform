import type { User } from "@firebase/auth";
import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Group, PublicProfile } from "@myhoodora/api-contract/types";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Check, Link2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { shareLink } from "@/shared/utils/share";
import { searchNeighbours } from "@/features/account/account-api";
import { getGroup, getInviteLink, groupKeys, inviteNeighbours } from "./groups-api";

/** Shares the group's invite link through the phone's share sheet (WhatsApp, SMS…). */
export async function shareInvite(user: User, g: Group, toast: ReturnType<typeof useToast>) {
  try {
    const { url } = await getInviteLink(user, g._id);
    // The API returns the web's link; share its path so it goes to the right site for this build.
    const u = new URL(url);
    await shareLink(`${u.pathname}${u.search}`, `Join ${g.name} on myHoodora`);
  } catch (err) {
    toast(errorMessage(err), "error");
  }
}

/** Wait for a pause in typing before searching. */
function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** `/g/<id>/invite`: find neighbours by name and invite several at once, or share a link. */
export function GroupInviteScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const group = useQuery({ queryKey: groupKeys.one(id), queryFn: () => getGroup(user, id) });
  return (
    <AppScreen title="Invite neighbours" fallback={`/g/${id}`} canvas={false}>
      {group.data ? <Invite group={group.data} /> : group.isPending ? <LoadingState /> : <ErrorState error={group.error} onRetry={() => void group.refetch()} />}
    </AppScreen>
  );
}

function Invite({ group: g }: { group: Group }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Map<string, PublicProfile>>(new Map());
  const q = useDebounced(text.trim());
  const results = useQuery({ queryKey: ["neighbours", q], queryFn: () => searchNeighbours(user, q), enabled: q.length >= 2, placeholderData: keepPreviousData });
  const send = useMutation({
    mutationFn: () => inviteNeighbours(user, g._id, [...picked.keys()]),
    onSuccess: () => {
      toast(picked.size === 1 ? "Invite sent." : `${picked.size} invites sent.`);
      router.back();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const toggle = (p: PublicProfile) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(p.uid)) next.delete(p.uid);
      else next.set(p.uid, p);
      return next;
    });
  const rows = (results.data ?? []).filter((p) => p.uid !== user.uid);

  const footer = picked.size ? (
    <GlassSurface style={[styles.footer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Button label={picked.size === 1 ? "Send 1 invite" : `Send ${picked.size} invites`} onPress={() => send.mutate()} loading={send.isPending} />
    </GlassSurface>
  ) : null;

  return (
    <View style={styles.flex}>
      <FlatList
        data={q.length >= 2 ? rows : []}
        keyExtractor={(p) => p.uid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.grow, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => void shareInvite(user, g, toast)} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderColor: t.colors.border }]}>
              <View style={[styles.linkIcon, { backgroundColor: t.colors.primary }]}>
                <Link2 size={20} color={t.colors.primaryForeground} />
              </View>
              <View style={styles.flex}>
                <Text variant="label">Share an invite link</Text>
                <Text variant="caption" tone="muted">
                  WhatsApp, text, or anywhere{g.privacy === "private" ? ". It lets them in without asking" : ""}
                </Text>
              </View>
            </Pressable>
            <View style={[styles.box, { backgroundColor: t.colors.muted }]}>
              <Search size={18} color={t.colors.mutedForeground} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Search neighbours by name"
                placeholderTextColor={t.colors.mutedForeground}
                autoCorrect={false}
                autoFocus
                accessibilityLabel="Search neighbours by name"
                style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
              />
              {results.isFetching ? <ActivityIndicator size="small" color={t.colors.primary} /> : null}
              {text ? (
                <Pressable onPress={() => setText("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
                  <X size={18} color={t.colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {picked.size ? (
              <View style={styles.chips}>
                {[...picked.values()].map((p) => (
                  <Pressable key={p.uid} onPress={() => toggle(p)} accessibilityRole="button" accessibilityLabel={`Remove ${p.displayName}`} style={[styles.chip, { backgroundColor: t.colors.muted }]}>
                    <Avatar name={p.displayName} photoURL={p.photoURL} size={22} />
                    <Text variant="caption">{p.displayName}</Text>
                    <X size={14} color={t.colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const on = picked.has(item.uid);
          return (
            <Pressable onPress={() => toggle(item)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={item.displayName} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}>
              <Avatar name={item.displayName} photoURL={item.photoURL} size={44} />
              <View style={styles.flex}>
                <Text variant="label">{item.displayName}</Text>
                {item.neighborhoodName ? (
                  <Text variant="caption" tone="muted">
                    {item.neighborhoodName}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.check, { borderColor: on ? t.colors.primary : t.colors.border, backgroundColor: on ? t.colors.primary : "transparent" }]}>{on ? <Check size={14} color={t.colors.primaryForeground} /> : null}</View>
            </Pressable>
          );
        }}
        ListEmptyComponent={q.length >= 2 && results.data ? <EmptyState title={`No neighbours called “${q}”`} body="Only verified neighbours in your neighbourhood show here. Share the link for anyone else." /> : null}
      />
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: { paddingHorizontal: 16, gap: 14, marginBottom: 8 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  linkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  box: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: MIN_TOUCH },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 999 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: MIN_TOUCH + 16 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
