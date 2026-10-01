"use client";

import { eventEndsAt } from "@/features/events/event-time";
import Link from "next/link";
import { useMemo } from "react";
import { BadgeCheck, CalendarDays, ChevronRight, Hourglass, ShieldAlert } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { isActiveAlert } from "@/features/alerts/lifecycle";
import { useFeed } from "@/features/feed/feed-context";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { dateBadge } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

function NeighbourhoodCard() {
  const { profile } = useAuth();
  const hood = useNeighbourhood();
  const { posts } = useFeed();
  const verified = profile?.verificationStatus === "verified";
  const requested = profile?.verificationStatus === "pending_review" ? profile.requestedHood : null;
  const activeAlerts = posts.filter((p) => isActiveAlert(p)).length;

  return (
    <section aria-label="Your neighbourhood" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <span className="relative flex size-11 items-center justify-center rounded-full bg-primary/10">
          <span className="size-3.5 rounded-full bg-primary ring-4 ring-primary/20" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{hood?.name ?? requested?.name ?? "Your neighbourhood"}</p>
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            {hood?.city}
            {verified ? (
              <span className="inline-flex items-center gap-0.5 text-primary">
                {hood?.city && " · "}
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            ) : requested ? (
              <span className="inline-flex items-center gap-0.5 text-primary">
                <Hourglass className="size-3.5" aria-hidden /> Waiting for approval
              </span>
            ) : (
              <span className="text-warning">{hood?.city && " · "}Not verified</span>
            )}
          </p>
        </div>
      </div>
      <Link
        href={ROUTES.alerts}
        className="flex items-center justify-between border-t border-border px-4 py-3 text-[15px] font-semibold hover:bg-muted"
      >
        <span className="flex items-center gap-2">
          <ShieldAlert className={cn("size-4", activeAlerts ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          {activeAlerts ? `${activeAlerts} active alert${activeAlerts > 1 ? "s" : ""}` : "No active alerts"}
        </span>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function UpcomingEvents() {
  const { posts } = useFeed();
  const upcoming = useMemo(
    () =>
      posts
        // Still listed while it's on (until it ends), like the Events page.
        .filter((p) => p.meta.category === "event" && p.meta.eventDate && eventEndsAt(p.meta.eventDate) > new Date())
        .sort((a, b) => a.meta.eventDate!.localeCompare(b.meta.eventDate!))
        .slice(0, 3),
    [posts],
  );

  return (
    <section aria-labelledby="rail-events" className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="rail-events" className="text-base font-bold">
          Upcoming events
        </h2>
        <Link href={ROUTES.events} className="text-sm font-semibold text-primary hover:underline">
          See all
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden /> Nothing planned yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((e) => {
            const badge = dateBadge(e.meta.eventDate!);
            return (
              <li key={e._id}>
                <Link href={ROUTES.post(e._id)} className="group flex items-center gap-3">
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-none">
                    <span className="text-[10px] font-bold text-brand-coral">{badge.month}</span>
                    <span className="text-lg font-bold">{badge.day}</span>
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{e.message}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RightRail() {
  return (
    <aside className="sticky top-[88px] hidden w-[300px] shrink-0 space-y-4 self-start xl:block">
      <NeighbourhoodCard />
      <UpcomingEvents />
      <p className="px-2 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        {" · "}
        <Link href={ROUTES.guidelines} className="hover:underline">Guidelines</Link>
        {" · "}
        <Link href={ROUTES.help} className="hover:underline">Help</Link>
        {" · "}© {new Date().getFullYear()} myHoodora
      </p>
    </aside>
  );
}

/** Feed-width column + right rail (Home, post pages, notifications). */
export function PageWithRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 xl:max-w-[640px]">{children}</div>
      <RightRail />
    </div>
  );
}
