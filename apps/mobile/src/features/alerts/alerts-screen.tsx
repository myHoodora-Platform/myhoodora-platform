import type { AlertCategory, ApiPost } from "@myhoodora/api-contract/types";
import { Plus, ShieldCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { IconButton } from "@/shared/ui/icon-button";
import { FeedSkeleton, Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { PostCard } from "@/features/feed/post-card";
import { ALERT_TYPES } from "./alert-kinds";
import { activeCounts, splitAlerts } from "./alert-lifecycle";
import { useHoodArea, useRecentAlerts } from "./alerts-data";
import { HoodMap } from "./hood-map";

type Filter = "all" | AlertCategory;
type Row = { kind: "heading"; id: string; title: string; note?: string } | { kind: "calm"; id: string } | { kind: "post"; id: string; post: ApiPost };


export const alertFilter = (raw: string | undefined): Filter => (ALERT_TYPES.some((k) => k.id === raw) ? (raw as AlertCategory) : "all");

/**
 * `/alerts` (the web's Alerts page, Nextdoor's map-first alerts): your neighbourhood on a map, what's
 * active now (urgent first), and the rest of the week. `?type=power` opens one kind.
 */
export function AlertsScreen({ type }: { type?: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const post = () => router.push("/compose?kind=alert");
  return (
    <AppScreen title="Alerts" fallback="/menu" right={hasHood(profile) ? <IconButton Icon={Plus} label="Post an alert" onPress={post} /> : undefined}>
      {hasHood(profile) ? (
        <AlertsList hoodId={profile.neighborhoodId} initial={alertFilter(type)} onPost={post} />
      ) : (
        <EmptyState title="Join your neighbourhood first" body="Alerts come from the verified neighbours around you, so confirm where you live to see them." action={{ label: "Confirm my address", onPress: () => router.push("/onboarding") }} />
      )}
    </AppScreen>
  );
}

function AlertsList({ hoodId, initial, onPost }: { hoodId: string; initial: Filter; onPost: () => void }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const [filter, setFilter] = useState<Filter>(initial);
  // Checked against once per visit, so the lists don't reshuffle while you read (and render stays pure).
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const { query: alerts, all } = useRecentAlerts(hoodId, now);
  const { area, name } = useHoodArea(hoodId);
  const pull = usePullRefresh(alerts.refetch);

  const counts = useMemo(() => activeCounts(all, now), [all, now]);
  const rows = useMemo((): Row[] => {
    const ofType = filter === "all" ? all : all.filter((p) => (p.alertCategory ?? "other") === filter);
    const { active, earlier } = splitAlerts(ofType, now);
    if (!ofType.length) return [];
    const out: Row[] = [{ kind: "heading", id: "h-active", title: active.length ? `Active now (${active.length})` : "Active now" }];
    if (active.length) out.push(...active.map((post): Row => ({ kind: "post", id: post._id, post })));
    else out.push({ kind: "calm", id: "calm" });
    if (earlier.length) {
      out.push({ kind: "heading", id: "h-earlier", title: `Earlier this week (${earlier.length})`, note: "Ended or resolved. Kept here for 7 days so you can catch up." });
      out.push(...earlier.map((post): Row => ({ kind: "post", id: post._id, post })));
    }
    return out;
  }, [all, filter, now]);

  const header = (
    <View style={styles.header}>
      <View style={[styles.mapCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <View style={[styles.map, { backgroundColor: t.colors.muted }]}>
          {area ? (
            <HoodMap lng={area.centre[0]} lat={area.centre[1]} radiusMeters={area.radiusMeters} name={area.name} alerts={all} now={now} onOpen={() => router.push("/alerts/map")} />
          ) : (
            <Skeleton height="100%" radius={0} />
          )}
        </View>
        <View style={styles.intro}>
          <Text variant="heading">Alerts in {name ?? "your neighbourhood"}</Text>
          <Text variant="caption" tone="muted">
            Security, power, flooding and other updates from verified neighbours.
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow} accessibilityLabel="Alert type">
        <Chip label={counts.all ? `All (${counts.all})` : "All"} selected={filter === "all"} onPress={() => setFilter("all")} />
        {ALERT_TYPES.map((k) => (
          <Chip key={k.id} Icon={k.Icon} label={counts[k.id] ? `${k.label} (${counts[k.id]})` : k.label} selected={filter === k.id} onPress={() => setFilter(k.id)} />
        ))}
      </ScrollView>
    </View>
  );

  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 };
  if (alerts.isPending) {
    return (
      <View style={pad}>
        {header}
        <FeedSkeleton />
      </View>
    );
  }
  if (!alerts.data) return <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} title="Couldn't load alerts" />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={[styles.list, pad]}
      scrollIndicatorInsets={{ top: insets.top }}
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        item.kind === "post" ? (
          <PostCard post={item.post} />
        ) : item.kind === "calm" ? (
          <AllClear />
        ) : (
          <View style={styles.heading}>
            <Text variant="label" accessibilityRole="header">
              {item.title}
            </Text>
            {item.note ? (
              <Text variant="caption" tone="muted">
                {item.note}
              </Text>
            ) : null}
          </View>
        )
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyState
            title={filter === "all" ? "No alerts in the last week" : "No alerts of this type this week"}
            body="Nothing has been reported recently. If you see something neighbours should know about, let them know."
          />
          <Button label="Post an alert" variant="secondary" onPress={onPost} style={styles.emptyButton} />
        </View>
      }
      onEndReached={() => alerts.hasNextPage && !alerts.isFetchingNextPage && void alerts.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={alerts.isFetchingNextPage ? <ActivityIndicator color={t.colors.primary} accessibilityLabel="Loading older alerts" /> : null}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

/** Reassurance when nothing is active. */
function AllClear() {
  const t = useTheme();
  return (
    <View style={[styles.clear, { backgroundColor: t.colors.successSoft }]} accessible>
      <ShieldCheck size={20} color={t.colors.success} />
      <Text variant="caption" style={[styles.flex, { color: t.colors.foreground }]}>
        <Text variant="caption" style={{ fontFamily: t.fonts.bold, color: t.colors.foreground }}>
          No active alerts right now.
        </Text>{" "}
        Recent alerts that have ended are listed below.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 8, flexGrow: 1 },
  header: { gap: 12, paddingBottom: 4 },
  mapCard: { marginHorizontal: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  map: { height: 190 },
  intro: { padding: 14, gap: 2 },
  chipRow: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16 },
  heading: { paddingHorizontal: 16, paddingTop: 8, gap: 2 },
  clear: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, padding: 12, borderRadius: 16 },
  empty: { alignItems: "center" },
  emptyButton: { alignSelf: "center" },
});
