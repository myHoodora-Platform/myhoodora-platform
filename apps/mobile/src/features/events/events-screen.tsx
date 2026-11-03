import type { ApiPost } from "@myhoodora/api-contract/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { IconButton } from "@/shared/ui/icon-button";
import { Segmented } from "@/shared/ui/settings";
import { FeedSkeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useFeatureSignal } from "@/features/feedback/use-feature-signal";
import { feedKeys, listFeed, nextCursor, pagePosts } from "@/features/feed/feed-api";
import { postText } from "@/features/feed/post-parts";
import { EventFacts, RsvpBar } from "./event-details";
import { eventTitle, splitEvents } from "./event-time";

type Tab = "upcoming" | "past";

/**
 * `/events` (the web's Events): what's coming up in your neighbourhood, soonest first, with Going and
 * Interested on each; and what has happened. Events are posts, so they're kept with the feed and an
 * RSVP here shows in the feed too.
 */
export function EventsScreen() {
  useFeatureSignal("events");
  const router = useRouter();
  const { profile } = useAuth();
  return (
    <AppScreen title="Events" fallback="/menu" right={hasHood(profile) ? <IconButton Icon={Plus} label="Create an event" onPress={() => router.push("/compose?kind=event")} /> : undefined}>
      {hasHood(profile) ? (
        <EventsList hoodId={profile.neighborhoodId} />
      ) : (
        <EmptyState title="Join your neighbourhood first" body="Events are shared with the neighbours around you, so confirm where you live to see them." action={{ label: "Confirm my address", onPress: () => router.push("/onboarding") }} />
      )}
    </AppScreen>
  );
}

function EventsList({ hoodId }: { hoodId: string }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const events = useInfiniteQuery({
    queryKey: [...feedKeys.hood(hoodId), "events-screen"],
    queryFn: ({ pageParam }) => listFeed(user, hoodId, pageParam, "event"),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => nextCursor(page),
  });
  const pull = usePullRefresh(events.refetch);
  const { upcoming, past } = useMemo(() => splitEvents(events.data?.pages.flatMap(pagePosts) ?? []), [events.data]);
  const rows = tab === "upcoming" ? upcoming : past;
  const create = () => router.push("/compose?kind=event");

  if (events.isPending) {
    return (
      <View style={{ paddingTop: insets.top + 12 }}>
        <FeedSkeleton />
      </View>
    );
  }
  if (!events.data) return <ErrorState error={events.error} onRetry={() => void events.refetch()} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(p) => p._id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      ListHeaderComponent={
        <Segmented
          label="Which events"
          value={tab}
          onChange={setTab}
          options={[
            { id: "upcoming", label: upcoming.length ? `Upcoming (${upcoming.length})` : "Upcoming" },
            { id: "past", label: "Past" },
          ]}
        />
      }
      renderItem={({ item }) => <EventCard post={item} />}
      onEndReached={() => events.hasNextPage && !events.isFetchingNextPage && void events.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={events.isFetchingNextPage ? <ActivityIndicator color={t.colors.primary} accessibilityLabel="Loading more events" /> : null}
      ListEmptyComponent={
        tab === "upcoming" ? (
          <EmptyState title="Nothing coming up yet" body="Organising a clean-up, a residents' meeting or a party? Invite your neighbours." action={{ label: "Create an event", onPress: create }} />
        ) : (
          <EmptyState title="No past events" body="Events move here once they've ended." />
        )
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

/** One event: the calendar page, title, when and where, who's hosting, and the RSVP buttons. */
function EventCard({ post }: { post: ApiPost }) {
  const t = useTheme();
  const router = useRouter();
  const { title, rest } = eventTitle(postText(post));
  const host = post.author?.displayName ?? "A neighbour";
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Pressable onPress={() => router.push(`/p/${post._id}`)} accessibilityRole="link" accessibilityLabel={`${title}. Hosted by ${host}. Opens the event`} style={styles.cardBody}>
        <EventFacts post={post} title={title} />
        {rest ? (
          <Text tone="muted" numberOfLines={2}>
            {rest}
          </Text>
        ) : null}
        <View style={styles.host}>
          <Avatar name={host} photoURL={post.author?.photoURL} size={22} />
          <Text variant="caption" tone="muted">
            Hosted by {host}
          </Text>
        </View>
      </Pressable>
      <RsvpBar post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  card: { padding: 14, gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  cardBody: { gap: 10 },
  host: { flexDirection: "row", alignItems: "center", gap: 6 },
});
