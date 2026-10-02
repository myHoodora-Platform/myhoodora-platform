"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { FilterChips, type ChipItem } from "@/components/shared/filter-chips";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { ALERT_CATEGORIES } from "@/features/feed/categories";
import { useBlocked } from "@/hooks/use-blocked";
import { NoActiveAlerts } from "./active-alerts-card";
import { alertStatus, isActiveAlert, isRecentAlert } from "./lifecycle";
import { useComposer } from "@/features/feed/composer-context";
import { useFeed } from "@/features/feed/feed-context";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PostCard } from "@/features/feed/components/post-card";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { ROUTES } from "@/lib/routes";
import type { AlertCategory } from "@/lib/api/types";

// maplibre is ~200KB — only fetched when the Alerts page is opened.
const AlertsMap = dynamic(() => import("./alerts-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

type AlertFilter = "all" | AlertCategory;

export function AlertsPage() {
  const { profile } = useAuth();
  const hood = useNeighbourhood();
  const { posts, loading, error, refetch, react, deletePost, hasMore, loadMore, loadingMore } = useFeed();
  const { openComposer } = useComposer();
  const raw = useSearchParams().get("type");
  const filter: AlertFilter = ALERT_CATEGORIES.some((c) => c.id === raw) ? (raw as AlertCategory) : "all";

  const blocked = useBlocked();
  // Only the last week is kept on the Alerts page (Nextdoor's map does the same).
  const alerts = useMemo(
    () => posts.filter((p) => isRecentAlert(p) && !blocked.has(p.authorUid)),
    [posts, blocked],
  );
  const ofType = filter === "all" ? alerts : alerts.filter((p) => (p.meta.alertCategory ?? "other") === filter);
  // Urgent first, then newest; ended/resolved move to "Earlier this week".
  const rank = { urgent: 0, active: 1, resolved: 2, ended: 2 } as const;
  const active = ofType
    .filter((p) => isActiveAlert(p))
    .sort((a, b) => rank[alertStatus(a)] - rank[alertStatus(b)] || b.createdAt.localeCompare(a.createdAt));
  const earlier = ofType.filter((p) => !isActiveAlert(p));

  // Chip counts show what's active now, so a busy category stands out.
  const chips: ChipItem<AlertFilter>[] = [
    { id: "all", label: "All", count: alerts.filter((p) => isActiveAlert(p)).length },
    ...ALERT_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      count: alerts.filter((p) => isActiveAlert(p) && (p.meta.alertCategory ?? "other") === c.id).length,
    })),
  ];

  const [lng, lat] = hood?.location?.coordinates ?? [profile?.location?.lng, profile?.location?.lat];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-56 sm:h-72">
          {lat !== undefined && lng !== undefined ? (
            <AlertsMap lat={lat} lng={lng} radiusMeters={hood?.radiusMeters ?? 1500} />
          ) : (
            <Skeleton className="size-full rounded-none" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Alerts in {hood?.name ?? "your neighbourhood"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Security, power, flooding and other updates from verified neighbours.
            </p>
          </div>
          <Button size="sm" onClick={() => openComposer("alert")}>
            <Plus className="size-4" />
            Post an alert
          </Button>
        </div>
      </div>

      <FilterChips
        label="Alert type"
        items={chips}
        active={filter}
        hrefFor={(id) => (id === "all" ? ROUTES.alerts : `${ROUTES.alerts}?type=${id}`)}
      />

      {loading ? (
        <FeedSkeleton count={2} />
      ) : error ? (
        <ErrorState title="Couldn't load alerts" message={error.message} onRetry={() => void refetch()} />
      ) : ofType.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={filter === "all" ? "No alerts in the last week" : "No alerts of this type this week"}
          description="Nothing has been reported recently. If you see something neighbours should know about, let them know."
          action={
            <Button size="sm" variant="outline" onClick={() => openComposer("alert")}>
              Post an alert
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="alerts-active" className="space-y-3">
            <h2 id="alerts-active" className="text-base font-bold">
              Active now {active.length > 0 && <span className="text-muted-foreground">({active.length})</span>}
            </h2>
            {active.length === 0 ? (
              <NoActiveAlerts />
            ) : (
              active.map((post) => <PostCard key={post._id} post={post} onReact={react} onDelete={deletePost} />)
            )}
          </section>
          {earlier.length > 0 && (
            <section aria-labelledby="alerts-earlier" className="space-y-3">
              <h2 id="alerts-earlier" className="text-base font-bold">
                Earlier this week <span className="text-muted-foreground">({earlier.length})</span>
              </h2>
              <p className="-mt-1 text-sm text-muted-foreground">
                Ended or resolved. Kept here for 7 days so you can catch up.
              </p>
              {earlier.map((post) => (
                <PostCard key={post._id} post={post} onReact={react} onDelete={deletePost} />
              ))}
            </section>
          )}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} loading={loadingMore}>
            Load older posts
          </Button>
        </div>
      )}
    </div>
  );
}
