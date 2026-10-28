import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { ArrowUp, ChevronDown, Hourglass, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { tint, useTheme } from "@/shared/theme/theme";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { FixedHeader, useHeaderEstimate } from "@/shared/ui/fixed-header";
import { useTabBarSpace } from "@/shared/ui/floating-tab-bar";
import { HoodMapBadge } from "@/shared/ui/hood-map-badge";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { FeedSkeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TopActions } from "@/features/navigation/top-actions";
import { liveStore, useLive } from "@/features/live/live-store";
import { underHeader, usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { FeedBanner } from "./feed-banners";
import { HoodSheet } from "./hood-sheet";
import { AdCard } from "@/features/ads/ad-card";
import { FeedPromptCard } from "@/features/feedback/feed-prompt-card";
import { adTracker, newFeedSession } from "@/features/ads/ad-tracking";
import { FEED_FILTERS, feedKeys, getHood, isAd, listHoodPage, type FeedEntry, type FeedFilter, type HoodPage } from "./feed-api";
import { PostCard } from "./post-card";

/**
 * The fixed header: your neighbourhood (a tiny map, tap for details and invites) on the left;
 * search, notifications and messages on the right (the same on every tab).
 */
function TopBar({ hood, updating = false, viewing, onView }: { hood?: { name: string; city?: string }; updating?: boolean; viewing?: string | null; onView?: (id: string | null) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${hood?.name ?? "Your neighbourhood"}. Neighbourhood details`}
        hitSlop={6}
        style={({ pressed }) => [styles.hood, { opacity: pressed ? 0.7 : 1 }]}
      >
        <HoodMapBadge size={36} />
        <Text variant="label" style={styles.hoodName} numberOfLines={1}>
          {hood?.name ?? "Your neighbourhood"}
        </Text>
        {updating ? <ActivityIndicator size="small" color={t.colors.mutedForeground} accessibilityLabel="Updating" /> : <ChevronDown size={16} color={t.colors.mutedForeground} />}
      </Pressable>
      <TopActions />
      <HoodSheet visible={open} onClose={() => setOpen(false)} viewing={viewing ?? null} onView={(id) => onView?.(id)} />
    </View>
  );
}

/** The grey between posts: the canvas showing through, not a border. */
function CardGap() {
  return <View style={styles.gap} />;
}

/** Onboarded, but not in a Hood yet: skipped, or waiting for staff to approve a request. */
function NotInHoodYet() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const pending = profile?.verificationStatus === "pending_review";
  return (
    <ScrollView contentContainerStyle={[styles.padded, { paddingTop: insets.top + 8 }]} style={{ backgroundColor: t.colors.canvas }}>
      <TopBar />
      <View style={[styles.joinCard, { backgroundColor: t.colors.card }]}>
        <View style={[styles.joinIcon, { backgroundColor: tint(t.colors.primary) }]}>{pending ? <Hourglass size={26} color={t.colors.primary} /> : <MapPin size={26} color={t.colors.primary} />}</View>
        <Text variant="title" style={styles.centred}>
          {pending ? `Waiting to join ${profile?.requestedHood?.name ?? "your neighbourhood"}` : "Finish joining your neighbourhood"}
        </Text>
        <Text tone="muted" style={styles.centred}>
          {pending
            ? "Our team is reviewing your request. We'll send you a notification when you're in."
            : "Confirm where you live to see alerts, recommendations and posts from verified neighbours."}
        </Text>
        {!pending ? <Button label="Confirm my address" onPress={() => router.push("/onboarding")} /> : null}
      </View>
    </ScrollView>
  );
}

/**
 * One feed session per neighbourhood and filter, renewed by pulling to refresh (contract §32): the
 * API places ads per session, and impressions count once per session.
 */
const feedSessions = new Map<string, string>();
function feedSession(key: string): string {
  let s = feedSessions.get(key);
  if (!s) feedSessions.set(key, (s = newFeedSession()));
  return s;
}

/** An ad counts as seen once at least half of it has been on screen for a second (§5.4). */
const SEEN = { itemVisiblePercentThreshold: 50, minimumViewTime: 1000 };
/** Videos play while most of the card is on screen. */
const PLAYING = { itemVisiblePercentThreshold: 60 };

export function FeedScreen() {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const homeId = hasHood(profile) ? profile.neighborhoodId : null;
  // Home, or a neighbourhood they follow (read only, contract §31). Falls back home if it was removed.
  const [viewing, setViewing] = useState<string | null>(null);
  const followed = profile?.secondaryHoods ?? [];
  const hoodId = viewing && followed.some((h) => h.id === viewing) ? viewing : homeId;
  const away = !!hoodId && hoodId !== homeId;
  const category = FEED_FILTERS.find((f) => f.id === filter)?.category;

  const hood = useQuery({ queryKey: feedKeys.hoodName(hoodId ?? ""), queryFn: () => getHood(user, hoodId!), enabled: !!hoodId, staleTime: Infinity });
  const sessionKey = `${hoodId}:${filter}`;
  const feed = useInfiniteQuery({
    queryKey: feedKeys.hood(hoodId ?? "", filter),
    queryFn: ({ pageParam }) => listHoodPage(user, hoodId!, { cursor: pageParam, category, session: feedSession(sessionKey) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: HoodPage) => page.next ?? undefined,
    enabled: !!hoodId,
  });
  const session = feedSession(sessionKey);
  const refresh = useCallback(() => {
    // A new session: fresh ad placement, and impressions count again.
    feedSessions.set(sessionKey, newFeedSession());
    return feed.refetch();
  }, [feed, sessionKey]);

  // Ads on screen now (videos play), and impressions once seen (§5.4). Stable callbacks: FlatList
  // doesn't allow changing them, so they read the latest user and session from `latest`.
  const [playing, setPlaying] = useState<ReadonlySet<string>>(() => new Set());
  const latest = useRef({ user, session });
  useEffect(() => {
    latest.current = { user, session };
  }, [user, session]);
  const [viewability] = useState(() => [
    {
      viewabilityConfig: SEEN,
      onViewableItemsChanged: ({ changed }: { changed: ViewToken<FeedEntry>[] }) => {
        for (const v of changed) if (v.isViewable && isAd(v.item)) adTracker.track(latest.current.user, { adId: v.item.ad._id, type: "impression", sessionId: latest.current.session });
      },
    },
    {
      viewabilityConfig: PLAYING,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<FeedEntry>[] }) => setPlaying(new Set(viewableItems.filter((v) => isAd(v.item)).map((v) => v.item._id))),
    },
  ]);

  const renderItem = useCallback(
    ({ item }: { item: FeedEntry }) => (isAd(item) ? <AdCard entry={item} session={session} active={playing.has(item._id)} /> : <PostCard post={item} />),
    [session, playing],
  );
  const [headerHeight, setHeaderHeight] = useState(useHeaderEstimate());
  const pull = usePullRefresh(refresh);
  const list = useRef<FlatList<FeedEntry>>(null);
  const { newPosts } = useLive();
  // "N new posts": load them and go to the top only when asked, so reading is never interrupted.
  const showNew = () => {
    liveStore.clearNewPosts();
    list.current?.scrollToOffset({ offset: 0, animated: true });
    void refresh();
  };
  const bottomSpace = useTabBarSpace();

  if (!hoodId) return <NotInHoodYet />;

  const posts = feed.data?.pages.flatMap((p) => p.entries) ?? [];
  const { padTop, padBottom, progressViewOffset, ...scroll } = underHeader(headerHeight, bottomSpace);
  // Refreshing in the background (not a pull): a small spinner in the header, nothing moves.
  const quietlyRefreshing = feed.isRefetching && !pull.refreshing && !feed.isFetchingNextPage;
  const label = FEED_FILTERS.find((f) => f.id === filter)?.label.toLowerCase();
  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: t.colors.foreground, fontFamily: t.fonts.bold }]}>{away ? `Today in ${hood.data?.name ?? "this neighbourhood"}` : "Today in your neighbourhood"}</Text>
      {away ? (
        <InlineAlert tone="info" action={<Text variant="label" tone="primary" onPress={() => setViewing(null)} accessibilityRole="button">Back to my neighbourhood</Text>}>
          You follow this neighbourhood: you can read it and hear its alerts. You post and sell in your home neighbourhood.
        </InlineAlert>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
        {FEED_FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={f.id === filter} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>
      {away ? null : <FeedBanner hoodName={hood.data?.name} />}
      {/* A feedback prompt an admin set to appear here (features/feedback). */}
      <FeedPromptCard />
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.canvas }]}>
    <FlatList
      ref={list}
      {...scroll}
      contentContainerStyle={[styles.list, { paddingTop: padTop + 12, paddingBottom: padBottom + 12 }]}
      data={feed.isPending || (feed.isError && !feed.data) ? [] : posts}
      keyExtractor={(p) => p._id}
      renderItem={renderItem}
      ItemSeparatorComponent={CardGap}
      ListHeaderComponent={header}
      ListEmptyComponent={
        feed.isPending ? (
          <FeedSkeleton label="Loading your neighbourhood feed" />
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => void refresh()} />
        ) : filter === "all" ? (
          <EmptyState title="It's quiet here" body="Nothing has been posted in your neighbourhood yet. Start the conversation." action={{ label: "Write a post", onPress: () => router.push("/compose") }} />
        ) : (
          <EmptyState title={`No ${label} yet`} body="Nothing like this has been posted in your neighbourhood yet." action={{ label: "Show everything", onPress: () => setFilter("all") }} />
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={t.colors.primary} accessibilityLabel="Loading more posts" />
        ) : feed.isFetchNextPageError ? (
          <ErrorState error={feed.error} onRetry={() => void feed.fetchNextPage()} title="Couldn't load more" />
        ) : posts.length > 0 && !feed.hasNextPage ? (
          <Text variant="caption" tone="muted" style={[styles.centred, styles.footer]}>
            You&apos;re all caught up.
          </Text>
        ) : null
      }
      onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError && void feed.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={progressViewOffset} />}
      viewabilityConfigCallbackPairs={viewability}
      removeClippedSubviews
      windowSize={7}
    />
    {newPosts > 0 ? (
      <Pressable
        onPress={showNew}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        style={[styles.newPosts, { top: headerHeight + 10, backgroundColor: t.colors.primary }]}
      >
        <ArrowUp size={16} color={t.colors.primaryForeground} />
        <Text variant="label" style={{ color: t.colors.primaryForeground }}>
          {newPosts === 1 ? "1 new post" : `${newPosts} new posts`}
        </Text>
      </Pressable>
    ) : null}
    <FixedHeader onHeight={setHeaderHeight}>
      <TopBar hood={hood.data ? { name: hood.data.name, city: hood.data.city } : undefined} updating={quietlyRefreshing} viewing={hoodId} onView={setViewing} />
    </FixedHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  header: { gap: 14, paddingHorizontal: 16, paddingBottom: 12 },
  gap: { height: 8 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flex: { flex: 1 },
  newPosts: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  hood: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minHeight: 44 },
  hoodName: { fontSize: 16, flexShrink: 1 },
  title: { fontSize: 24, lineHeight: 30 },
  chipsRow: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  padded: { padding: 16, gap: 16, flexGrow: 1 },
  joinCard: { borderRadius: 24, padding: 24, gap: 12, alignItems: "stretch" },
  joinIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  centred: { textAlign: "center" },
  footer: { paddingVertical: 20, paddingHorizontal: 16 },
});
