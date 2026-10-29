import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Group } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { IconButton } from "@/shared/ui/icon-button";
import { Segmented } from "@/shared/ui/settings";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { useFeatureSignal } from "@/features/feedback/use-feature-signal";
import { GroupAvatar, GroupMetaLine } from "./group-parts";
import { groupKeys, joinGroup, listGroups } from "./groups-api";

type Tab = "mine" | "discover";

/**
 * `/groups` (the web's Groups): the groups you're in, and the ones around you to join. Joining an open
 * group happens right here; a private one sends a request to its admins.
 */
export function GroupsScreen() {
  useFeatureSignal("groups");
  const router = useRouter();
  const { profile } = useAuth();
  return (
    <AppScreen title="Groups" fallback="/menu" right={hasHood(profile) ? <IconButton Icon={Plus} label="Start a group" onPress={() => router.push("/groups/new")} /> : undefined}>
      {hasHood(profile) ? (
        <GroupsList hoodId={profile.neighborhoodId} />
      ) : (
        <EmptyState title="Join your neighbourhood first" body="Groups are for neighbours, so confirm where you live to see and start them." action={{ label: "Confirm my address", onPress: () => router.push("/onboarding") }} />
      )}
    </AppScreen>
  );
}

function GroupsList({ hoodId }: { hoodId: string }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const router = useRouter();
  const user = useSignedInUser();
  const list = useQuery({ queryKey: groupKeys.list(hoodId), queryFn: () => listGroups(user, hoodId) });
  const pull = usePullRefresh(list.refetch);
  const mine = list.data?.filter((g) => g.membership === "member") ?? [];
  const others = list.data?.filter((g) => g.membership !== "member") ?? [];
  const [chosen, setChosen] = useState<Tab | null>(null);
  // Start on Discover when you're in nothing yet.
  const tab: Tab = chosen ?? (list.data && mine.length === 0 ? "discover" : "mine");
  const rows = tab === "mine" ? mine : others;

  if (list.isPending) {
    return (
      <View style={[styles.pad, { paddingTop: insets.top + 16 }]} accessible accessibilityLabel="Loading groups">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={56} height={56} radius={16} />
            <View style={[styles.flex, { gap: 6 }]}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="80%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(g) => g._id}
      contentContainerStyle={[styles.pad, styles.grow, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Segmented
            label="Which groups"
            value={tab}
            onChange={setChosen}
            options={[
              { id: "mine", label: mine.length ? `Your groups (${mine.length})` : "Your groups" },
              { id: "discover", label: "Discover" },
            ]}
          />
        </View>
      }
      renderItem={({ item }) => <GroupRow group={item} hoodId={hoodId} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        tab === "mine" ? (
          <EmptyState title="You're not in a group yet" body="Groups bring together neighbours around a street, an estate, a school or a hobby." action={{ label: "Find a group", onPress: () => setChosen("discover") }} />
        ) : (
          <EmptyState title="No other groups near you yet" body="Start one for your street, estate, or anything neighbours share." action={{ label: "Start a group", onPress: () => router.push("/groups/new") }} />
        )
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

/** One group: tap for the group; Join (or Ask) right on the row when you're not in it. */
function GroupRow({ group, hoodId }: { group: Group; hoodId: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/g/${group._id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. ${group.description}`}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderColor: t.colors.border }]}
    >
      <GroupAvatar group={group} />
      <View style={[styles.flex, styles.text]}>
        <Text variant="label" numberOfLines={1}>
          {group.name}
        </Text>
        <GroupMetaLine group={group} />
        <Text variant="caption" numberOfLines={2}>
          {group.description}
        </Text>
      </View>
      {group.membership !== "member" ? <JoinButton group={group} hoodId={hoodId} /> : null}
    </Pressable>
  );
}

/** Join / Ask to join / Requested, as a small pill. Optimistic: the list changes at once. */
export function JoinButton({ group, hoodId }: { group: Group; hoodId: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const join = useMutation({
    mutationFn: () => joinGroup(user, group._id),
    onSuccess: ({ membership }) => {
      const patch = (g: Group) => (g._id === group._id ? { ...g, membership, memberCount: g.memberCount + (membership === "member" ? 1 : 0) } : g);
      client.setQueryData<Group[]>(groupKeys.list(hoodId), (rows) => rows?.map(patch));
      client.setQueryData<Group>(groupKeys.one(group._id), (g) => (g ? patch(g) : g));
      toast(membership === "member" ? `You joined ${group.name}.` : "Request sent. An admin will let you in.");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const requested = group.membership === "requested";
  const label = requested ? "Requested" : group.privacy === "private" ? "Ask to join" : "Join";
  return (
    <Pressable
      onPress={() => !requested && join.mutate()}
      disabled={requested || join.isPending}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${group.name}`}
      hitSlop={6}
      style={[styles.join, { backgroundColor: requested ? t.colors.muted : tint(t.colors.primary, 0.12), opacity: join.isPending ? 0.6 : 1 }]}
    >
      <Text variant="label" style={{ color: requested ? t.colors.mutedForeground : t.colors.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  pad: { paddingHorizontal: 16, gap: 12 },
  header: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  gap: { height: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  text: { gap: 3 },
  join: { minHeight: 36, minWidth: MIN_TOUCH, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
