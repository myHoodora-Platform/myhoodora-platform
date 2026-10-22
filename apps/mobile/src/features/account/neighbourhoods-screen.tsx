import { errorMessage } from "@myhoodora/api-contract/errors";
import type { HoodRequestView } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Home, MessagesSquare, Plus, Truck, X } from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { HoodMapBadge } from "@/shared/ui/hood-map-badge";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { hoodKeys, leaveSecondaryHood, myHoods, withdrawHoodRequest } from "./account-api";

const STATUS: Record<HoodRequestView["status"], { label: string; tone: "warning" | "success" | "muted" | "destructive" }> = {
  pending: { label: "Waiting for review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  declined: { label: "Not approved", tone: "destructive" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
  removed: { label: "Removed", tone: "muted" },
};

function since(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `Since ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

function StatusPill({ status }: { status: HoodRequestView["status"] }) {
  const t = useTheme();
  const s = STATUS[status];
  const look = { warning: [t.colors.warningSoft, t.colors.warning], success: [t.colors.successSoft, t.colors.success], destructive: [t.colors.dangerSoft, t.colors.destructive], muted: [t.colors.muted, t.colors.mutedForeground] }[s.tone];
  return (
    <View style={[styles.pill, { backgroundColor: look[0] }]}>
      <Text variant="caption" style={{ color: look[1] }}>
        {s.label}
      </Text>
    </View>
  );
}

/**
 * `/settings/neighbourhoods`: home (where you post, sell and message), the neighbourhoods you also
 * follow (read and alerts), and your requests. Changing any of them goes through our team.
 */
export function NeighbourhoodsScreen() {
  return (
    <AppScreen title="Your neighbourhoods" fallback="/settings/profile">
      <NeighbourhoodsContent />
    </AppScreen>
  );
}

function NeighbourhoodsContent() {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const toast = useToast();
  const client = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const verified = hasHood(profile);
  const hoods = useQuery({ queryKey: hoodKeys.mine, queryFn: () => myHoods(user), enabled: verified });
  const padding = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 };

  if (!verified) {
    return (
      <View style={[styles.content, padding]}>
        <EmptyState
          title="Join your neighbourhood first"
          body="Once you've confirmed where you live, you can follow other neighbourhoods and ask us to move you if you move house."
          action={{ label: "Confirm my address", onPress: () => router.push("/onboarding") }}
        />
      </View>
    );
  }
  if (hoods.isPending) {
    return (
      <View style={[styles.content, padding]} accessible accessibilityLabel="Loading your neighbourhoods">
        <Skeleton height={90} radius={20} />
        <Skeleton height={140} radius={20} />
      </View>
    );
  }
  if (!hoods.data) return <ErrorState error={hoods.error} onRetry={() => void hoods.refetch()} />;

  const { home, secondary, requests, maxSecondary } = hoods.data;
  const pendingMove = requests.find((r) => r.kind === "move" && r.status === "pending");
  const pendingSecondary = requests.filter((r) => r.kind === "secondary" && r.status === "pending").length;
  const room = maxSecondary - secondary.length - pendingSecondary;

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: hoodKeys.mine });
    await refreshProfile();
  };

  const leave = (id: string, name: string) =>
    Alert.alert(`Stop following ${name}?`, "You'll stop seeing its posts and hearing its alerts. To follow it again you'd need to ask again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop following",
        style: "destructive",
        onPress: () =>
          void leaveSecondaryHood(user, id)
            .then(refresh)
            .then(() => toast(`You no longer follow ${name}.`))
            .catch((err: unknown) => toast(errorMessage(err), "error")),
      },
    ]);

  const withdraw = (r: HoodRequestView) =>
    Alert.alert("Withdraw this request?", undefined, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () =>
          void withdrawHoodRequest(user, r.id)
            .then(refresh)
            .catch((err: unknown) => toast(errorMessage(err), "error")),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={[styles.content, padding]} scrollIndicatorInsets={{ top: insets.top }}>
      <SettingsGroup title="Home" footer="Where you post, sell and message. Only our team can move you, so neighbourhoods stay local and trusted.">
        <SettingsRow leading={<HoodMapBadge size={44} />} label={home?.name ?? "Your neighbourhood"} description={home?.city} />
        {pendingMove ? (
          <SettingsRow Icon={Truck} label="Move requested" description={pendingMove.hood ? `To ${pendingMove.hood.name}` : "To a new address"} right={<StatusPill status="pending" />} />
        ) : (
          <SettingsRow Icon={Truck} label="Moved house? Ask to move" onPress={() => router.push("/settings/neighbourhoods/move")} />
        )}
      </SettingsGroup>

      <SettingsGroup title={`Also following · ${secondary.length} of ${maxSecondary}`} footer="See their posts and hear their safety alerts. You still post and sell at home.">
        {secondary.map((h) => (
          <SettingsRow
            key={h.id}
            leading={<HoodMapBadge size={40} />}
            label={h.name}
            description={[h.city, since(h.since)].filter(Boolean).join(" · ")}
            right={
              <Pressable onPress={() => leave(h.id, h.name)} accessibilityRole="button" accessibilityLabel={`Stop following ${h.name}`} hitSlop={10} style={[styles.x, { backgroundColor: t.colors.muted }]}>
                <X size={16} color={t.colors.mutedForeground} />
              </Pressable>
            }
          />
        ))}
        {room > 0 ? (
          <SettingsRow Icon={Plus} label="Follow another neighbourhood" description="Where you work, or where family lives" onPress={() => router.push("/settings/neighbourhoods/add")} />
        ) : (
          <SettingsRow Icon={Plus} label={secondary.length >= maxSecondary ? "You follow the most you can" : "Waiting for your requests"} description="Stop following one, or withdraw a request, to ask for another." />
        )}
      </SettingsGroup>

      {requests.length ? (
        <SettingsGroup title="Your requests">
          {requests.map((r) => (
            <View key={r.id} style={styles.request}>
              <View style={styles.requestHead}>
                <View style={[styles.kind, { backgroundColor: tint(t.colors.primary) }]}>{r.kind === "move" ? <Home size={16} color={t.colors.primary} /> : <Plus size={16} color={t.colors.primary} />}</View>
                <Text variant="label" style={styles.flex} numberOfLines={1}>
                  {r.kind === "move" ? `Move${r.hood ? ` to ${r.hood.name}` : ""}` : `Follow ${r.hood?.name ?? "a neighbourhood"}`}
                </Text>
                <StatusPill status={r.status} />
              </View>
              <Text variant="caption" tone="muted">
                “{r.reason}”
              </Text>
              {r.decisionNote ? <InlineAlert tone={r.status === "declined" ? "warning" : "info"}>{r.decisionNote}</InlineAlert> : null}
              <View style={styles.actions}>
                {r.threadId ? (
                  <Pressable onPress={() => router.push(`/inbox/support/${r.threadId}`)} accessibilityRole="button" hitSlop={8} style={styles.action}>
                    <MessagesSquare size={16} color={t.colors.primary} />
                    <Text variant="label" tone="primary">
                      Our team has a question
                    </Text>
                  </Pressable>
                ) : null}
                {r.status === "pending" ? (
                  <Text variant="label" tone="destructive" onPress={() => withdraw(r)} accessibilityRole="button" style={styles.action}>
                    Withdraw
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 22 },
  flex: { flex: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  request: { padding: 14, gap: 8 },
  requestHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  kind: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 18, flexWrap: "wrap" },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
});
