"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Newspaper } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { EmptyState } from "@/components/shared/states";
import { InlineRetry, ProblemState, StaleNotice } from "@/components/shared/connection-states";
import { FilterChips } from "@/components/shared/filter-chips";
import { useAuth } from "@/context/AuthContext";
import { ActiveAlertsCard } from "@/features/alerts/active-alerts-card";
import { FinishJoiningCard } from "@/features/onboarding/finish-joining-card";
import { isActiveAlert } from "@/features/alerts/lifecycle";
import { useBlocked } from "@/hooks/use-blocked";
import { ROUTES } from "@/lib/routes";
import type { PostCategory } from "@/lib/api/types";
import { FEED_FILTERS, matchesFilter, parseFeedFilter, type FeedFilter } from "../categories";
import { useComposer } from "../composer-context";
import { useFeed } from "../feed-context";
import { ComposerPrompt } from "./composer-prompt";
import { FeedSkeleton } from "./feed-skeleton";
import { PostCard } from "./post-card";

const EMPTY_COPY: Record<FeedFilter, { title: string; description: string; category: PostCategory }> = {
  all: { title: "Your neighbourhood is quiet", description: "Be the first to say hello, ask a question or share an update.", category: "general" },
  alerts: { title: "No alerts right now", description: "Good news: nothing reported recently. Seen something neighbours should know about?", category: "alert" },
  events: { title: "No events yet", description: "Organising a clean-up, meeting or party? Invite your neighbours.", category: "event" },
  "for-sale": { title: "Nothing for sale in the feed", description: "Items listed in For Sale & Free show up here.", category: "for_sale" },
  recommendations: { title: "No recommendation requests", description: "Looking for a trusted artisan or service? Ask your neighbours.", category: "recommendation" },
  general: { title: "No general posts yet", description: "Share an update or ask neighbours a question.", category: "general" },
};

export function NewsFeed() {
  const { posts, loading, refreshing, loadingMore, error, stale, loadMoreError, hasMore, loadMore, refetch, react, deletePost, incoming, showIncoming } =
    useFeed();
  const { openComposer } = useComposer();
  const filter = parseFeedFilter(useSearchParams().get("filter"));
  const blocked = useBlocked();

  // Chronological. In "All", active alerts live only in ActiveAlertsCard
  // (no duplicate full cards below it); they rejoin the feed once they end
  // or are resolved. The "Alerts" chip and Alerts page show them in full.
  const visible = useMemo(
    () =>
      posts.filter(
        (p) =>
          !blocked.has(p.authorUid) &&
          matchesFilter(p, filter) &&
          !(filter === "all" && isActiveAlert(p)),
      ),
    [posts, filter, blocked],
  );
  const hasActiveAlerts = filter === "all" && posts.some((p) => isActiveAlert(p) && !blocked.has(p.authorUid));

  // Hidden alerts can leave the first page looking thin — top it up once.
  // Capped at 2 automatic top-ups so a run of duplicate pages can't loop.
  const MIN_VISIBLE = 5;
  const topUps = useRef(0);
  useEffect(() => {
    if (loading) topUps.current = 0;
  }, [loading]);
  useEffect(() => {
    if (loading || error || loadingMore || loadMoreError || !hasMore) return;
    if (visible.length >= MIN_VISIBLE || topUps.current >= 2) return;
    topUps.current += 1;
    void loadMore();
  }, [loading, error, loadingMore, loadMoreError, hasMore, visible.length, loadMore]);

  const empty = EMPTY_COPY[filter];
  const { profile } = useAuth();

  // Skipped onboarding: no neighbourhood yet, so nothing to show.
  if (profile && !profile.neighborhoodId) return <FinishJoiningCard />;

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Home</h1>
      <ComposerPrompt />
      <FilterChips
        label="Filter posts"
        items={FEED_FILTERS}
        active={filter}
        hrefFor={(id) => (id === "all" ? ROUTES.newsFeed : `${ROUTES.newsFeed}?filter=${id}`)}
      />

      {incoming.length > 0 && (
        <div className="sticky top-20 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => {
              showIncoming();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02]"
          >
            <ArrowUp className="size-4" aria-hidden />
            {incoming.length === 1 ? "1 new post" : `${incoming.length} new posts`}
          </button>
        </div>
      )}

      {stale && !loading && (
        <StaleNotice kind={stale.kind} since={stale.since} onRetry={() => void refetch()} retrying={refreshing} />
      )}
      {refreshing && !stale && (
        <p role="status" className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden /> Checking for new posts…
        </p>
      )}

      {!loading && !error && filter === "all" && (
        <ActiveAlertsCard posts={posts.filter((p) => !blocked.has(p.authorUid))} />
      )}

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <ProblemState
          title="Couldn't load your neighbourhood feed"
          message={error.message}
          kind={error.kind}
          onRetry={() => void refetch()}
        />
      ) : visible.length === 0 && hasActiveAlerts ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          That&apos;s everything for now. Active alerts are summarised above.
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={empty.title}
          description={empty.description}
          action={
            <Button size="sm" onClick={() => openComposer(empty.category)}>
              {filter === "for-sale" ? "Sell or give away" : "Create a post"}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((post) => (
            <PostCard key={post._id} post={post} onReact={react} onDelete={deletePost} />
          ))}
        </div>
      )}

      {!loading && !error && hasMore &&
        (loadMoreError ? (
          <InlineRetry message={loadMoreError.message} onRetry={() => void loadMore()} retrying={loadingMore} />
        ) : (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => void loadMore()} loading={loadingMore}>
              Load more
            </Button>
          </div>
        ))}
    </div>
  );
}
