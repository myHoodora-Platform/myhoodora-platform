"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Newspaper } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { FilterChips } from "@/components/shared/filter-chips";
import { ROUTES } from "@/lib/routes";
import { errorMessage } from "@/lib/api/client";
import type { PostCategory } from "@/lib/api/types";
import { FEED_FILTERS, matchesFilter, parseFeedFilter, type FeedFilter } from "../categories";
import { useComposer } from "../composer-context";
import { useFeed } from "../feed-context";
import { ComposerPrompt } from "./composer-prompt";
import { FeedSkeleton } from "./feed-skeleton";
import { PostCard } from "./post-card";

/** Alerts newer than this stay pinned to the top of "All". */
const PIN_ALERTS_FOR_MS = 24 * 60 * 60 * 1000;

const EMPTY_COPY: Record<FeedFilter, { title: string; description: string; category: PostCategory }> = {
  all: { title: "Your neighbourhood is quiet", description: "Be the first to say hello, ask a question or share an update.", category: "general" },
  alerts: { title: "No alerts right now", description: "Good news: nothing reported recently. Seen something neighbours should know about?", category: "alert" },
  events: { title: "No events yet", description: "Organising a clean-up, meeting or party? Invite your neighbours.", category: "event" },
  "for-sale": { title: "Nothing for sale in the feed", description: "Items listed in For Sale & Free show up here.", category: "for_sale" },
  recommendations: { title: "No recommendation requests", description: "Looking for a trusted artisan or service? Ask your neighbours.", category: "recommendation" },
  general: { title: "No general posts yet", description: "Share an update or ask neighbours a question.", category: "general" },
};

export function NewsFeed() {
  const { posts, loading, loadingMore, error, hasMore, loadMore, refetch, react, deletePost } = useFeed();
  const { openComposer } = useComposer();
  const filter = parseFeedFilter(useSearchParams().get("filter"));

  const visible = useMemo(() => {
    const matching = posts.filter((p) => matchesFilter(p, filter));
    if (filter !== "all") return matching;
    // Recent alerts first, each group keeping its newest-first order.
    const now = Date.now();
    const isPinned = (p: (typeof posts)[number]) =>
      p.meta.category === "alert" && now - new Date(p.createdAt).getTime() < PIN_ALERTS_FOR_MS;
    return [...matching.filter(isPinned), ...matching.filter((p) => !isPinned(p))];
  }, [posts, filter]);

  const handleLoadMore = () => {
    loadMore().catch((err) => toast.error(errorMessage(err, "Couldn't load more posts.")));
  };

  const empty = EMPTY_COPY[filter];

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

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn't load your neighbourhood feed"
          message={error}
          onRetry={() => void refetch()}
        />
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

      {!loading && !error && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
