"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { alertCategoryDef } from "@/features/feed/categories";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Post } from "@/lib/api/types";
import { groupActiveAlerts } from "./lifecycle";

const MAX_ROWS = 3;

/**
 * Nextdoor's "yellow state": active alerts sit at the top of the feed, but
 * as ONE compact card (grouped by type) instead of a wall of full posts.
 * The full alert posts still appear in the feed at the time they were posted.
 */
export function ActiveAlertsCard({ posts }: { posts: Post[] }) {
  const hood = useNeighbourhood();
  const groups = useMemo(() => groupActiveAlerts(posts), [posts]);
  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.posts.length, 0);
  const shown = groups.slice(0, MAX_ROWS);
  const hidden = groups.length - shown.length;

  return (
    <section aria-labelledby="active-alerts" className="overflow-hidden rounded-2xl border border-warning/30 bg-card">
      <div className="flex items-center justify-between gap-3 bg-warning-soft/60 px-4 py-2.5">
        <h2 id="active-alerts" className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-warning" />
          </span>
          {total} active alert{total > 1 ? "s" : ""} in {hood?.name ?? "your neighbourhood"}
        </h2>
        <Link href={ROUTES.alerts} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          See all
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {shown.map((g) => {
          const def = alertCategoryDef(g.category);
          const href = g.posts.length === 1 ? ROUTES.post(g.latest._id) : `${ROUTES.alerts}?type=${g.category}`;
          return (
            <li key={g.category}>
              <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", def.tone)}>
                  <def.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {def.label}
                    {g.posts.length > 1 && (
                      <span className="font-semibold text-muted-foreground">· {g.posts.length} reports</span>
                    )}
                    {g.urgent && (
                      <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-white">Urgent</span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {timeAgo(g.latest.createdAt)} · {g.latest.message}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <Link href={ROUTES.alerts} className="block border-t border-border px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-muted/50">
          +{hidden} more type{hidden > 1 ? "s" : ""} of alert
        </Link>
      )}
    </section>
  );
}

/** Reassurance when there's nothing active (shown on the Alerts page). */
export function NoActiveAlerts() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success-soft/60 px-4 py-3 text-sm">
      <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />
      <p>
        <span className="font-bold">No active alerts right now.</span>{" "}
        <span className="text-foreground/75">Recent alerts that have ended are listed below.</span>
      </p>
    </div>
  );
}
