import { errorMessage } from "@myhoodora/api-contract/errors";
import { normaliseInviteCode, type InviteSummary } from "@myhoodora/api-contract/invites";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { searchNeighbours } from "@/features/account/account-api";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { claimInvite, dismissWhoInvited, getInviteSummary, inviteKeys } from "./invites-api";

/**
 * Path 7 of the referral plan (the web's WhoInvitedYouCard): asked once of everyone who joined since
 * the challenge began without a code. Type the code, or find the neighbour by name. Optional.
 */
export function WhoInvitedYouCard() {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const summary = useQuery({ queryKey: inviteKeys.me(user.uid), queryFn: () => getInviteSummary(user), staleTime: 5 * 60_000 });
  const [mode, setMode] = useState<"code" | "name">("code");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);
  const people = useQuery({ queryKey: ["invites", "who", debounced], queryFn: () => searchNeighbours(user, debounced), enabled: mode === "name" && debounced.length >= 2 });

  if (!summary.data?.askWhoInvited) return null;
  const patch = (change: Partial<InviteSummary>) => client.setQueryData<InviteSummary>(inviteKeys.me(user.uid), (s) => (s ? { ...s, ...change } : s));
  const send = async (input: { code?: string; uid?: string }) => {
    setBusy(true);
    setProblem(null);
    try {
      const { invitedBy } = await claimInvite(user, { ...input, via: "asked" });
      patch({ askWhoInvited: false, invitedBy });
      toast(`Thanks! ${invitedBy.name} gets the credit for inviting you.`);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const dismiss = () => {
    patch({ askWhoInvited: false });
    void dismissWhoInvited(user).catch(() => undefined);
  };
  const typed = normaliseInviteCode(code);
  const found = (people.data ?? []).filter((p) => p.kind !== "organisation").slice(0, 5);

  return (
    <View style={[styles.card, { backgroundColor: tint(t.colors.primary, 0.06), borderColor: tint(t.colors.primary, 0.3) }]}>
      <View style={styles.top}>
        <HeartHandshake size={20} color={t.colors.primary} />
        <View style={styles.flex}>
          <Text variant="label">Did a neighbour invite you?</Text>
          <Text variant="caption" tone="muted">
            Tell us who, and they get the credit for building up the neighbourhood. You can skip this.
          </Text>
        </View>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="No one invited me. Close" hitSlop={10} style={styles.close}>
          <X size={18} color={t.colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={[styles.tabs, { backgroundColor: t.colors.muted }]} accessibilityRole="tablist">
        {(
          [
            ["code", "I have their code"],
            ["name", "Find them by name"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => {
              setMode(key);
              setProblem(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === key }}
            style={[styles.tab, mode === key && { backgroundColor: t.colors.card }]}
          >
            <Text variant="caption" tone={mode === key ? "default" : "muted"}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === "code" ? (
        <View style={styles.codeRow}>
          <View style={styles.flex}>
            <TextField label="Invite code" placeholder="e.g. ADA7K" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={14} />
          </View>
          <Button label={busy ? "Saving…" : "Save"} disabled={!typed || busy} onPress={() => typed && void send({ code: typed })} style={styles.save} />
        </View>
      ) : (
        <View style={styles.gap}>
          <TextField label="Their name" placeholder="Start typing" value={query} onChangeText={setQuery} autoCorrect={false} />
          {found.map((p) => (
            <Pressable key={p.uid} disabled={busy} onPress={() => void send({ uid: p.uid })} accessibilityRole="button" style={({ pressed }) => [styles.person, pressed && { backgroundColor: t.colors.muted }]}>
              <Avatar name={p.displayName} photoURL={p.photoURL} size={32} />
              <Text variant="label" numberOfLines={1} style={styles.flex}>
                {p.displayName}
              </Text>
            </Pressable>
          ))}
          {debounced.length >= 2 && people.isSuccess && !found.length ? (
            <Text variant="caption" tone="muted">
              No neighbour by that name in your Hood yet. Try their code instead.
            </Text>
          ) : null}
        </View>
      )}
      {problem ? (
        <Text variant="caption" tone="destructive" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  flex: { flex: 1 },
  close: { width: MIN_TOUCH - 12, height: MIN_TOUCH - 12, alignItems: "center", justifyContent: "center", marginTop: -6, marginRight: -6 },
  tabs: { flexDirection: "row", alignSelf: "flex-start", borderRadius: 999, padding: 3 },
  tab: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  codeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  save: { minWidth: 88 },
  gap: { gap: 6 },
  person: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH, paddingHorizontal: 8, borderRadius: 10 },
});
