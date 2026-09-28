"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { FilterChips } from "@/components/shared/filter-chips";
import { EmptyState, ErrorState, PageHeader, PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useComposer } from "@/features/feed/composer-context";
import { useFeed } from "@/features/feed/feed-context";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { dateBadge, formatEventDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Post } from "@/lib/api/types";
import { RsvpButtons } from "./rsvp-buttons";

type Tab = "upcoming" | "past";

/** The first sentence (or line) of the post doubles as the event title. */
function eventTitle(post: Post): { title: string; rest: string } {
  const text = post.message.trim();
  const end = text.search(/[.!?\n]/);
  const cut = end === -1 ? text.length : end + (text[end] === "\n" ? 0 : 1);
  const title = text.slice(0, cut).trim();
  if (title.length > 90) return { title: `${title.slice(0, 87).trimEnd()}…`, rest: text };
  return { title, rest: text.slice(cut).trim() };
}

function EventCard({ post }: { post: Post }) {
  const viewer = useViewer();
  const host = resolveAuthor(post.authorUid, viewer);
  const { title, rest } = eventTitle(post);
  const badge = post.meta.eventDate ? dateBadge(post.meta.eventDate) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <Link href={ROUTES.post(post._id)} className="flex gap-4 p-4 hover:bg-muted/40 sm:p-5">
        <div className="flex w-14 shrink-0 flex-col items-center self-start rounded-xl border border-border py-2 leading-none">
          <span className="text-xs font-bold text-brand-coral">{badge?.month ?? "TBC"}</span>
          <span className="text-2xl font-bold">{badge?.day ?? "–"}</span>
          <span className="text-[11px] text-muted-foreground">{badge?.weekday}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {post.meta.eventDate && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" aria-hidden /> {formatEventDate(post.meta.eventDate)}
            </p>
          )}
          {post.meta.eventLocation && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden /> {post.meta.eventLocation}
            </p>
          )}
          {rest && <p className="line-clamp-2 text-sm text-foreground/80">{rest}</p>}
          <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <UserAvatar person={host} size="sm" className="size-6 text-[10px]" /> Hosted by {host.displayName}
          </p>
        </div>
      </Link>
      <div className="border-t border-border px-4 py-3 sm:px-5">
        <RsvpButtons postId={post._id} />
      </div>
    </article>
  );
}

export function EventsPage() {
  const { posts, loading, error, refetch } = useFeed();
  const { openComposer } = useComposer();
  const tab: Tab = useSearchParams().get("tab") === "past" ? "past" : "upcoming";

  const { upcoming, past } = useMemo(() => {
    const now = new Date().toISOString();
    const events = posts.filter((p) => p.meta.category === "event");
    // Events without a date (older posts) count as upcoming so they aren't lost.
    const up = events
      .filter((p) => !p.meta.eventDate || p.meta.eventDate >= now)
      .sort((a, b) => (a.meta.eventDate ?? "9").localeCompare(b.meta.eventDate ?? "9"));
    const gone = events
      .filter((p) => p.meta.eventDate && p.meta.eventDate < now)
      .sort((a, b) => b.meta.eventDate!.localeCompare(a.meta.eventDate!));
    return { upcoming: up, past: gone };
  }, [posts]);

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Events"
        description="What's happening in your neighbourhood."
        actions={
          <Button size="sm" onClick={() => openComposer("event")}>
            <Plus className="size-4" />
            Create event
          </Button>
        }
      />
      <PreviewNotice endpoint="events.rsvp" />
      <FilterChips
        label="Events"
        items={[
          { id: "upcoming" as const, label: "Upcoming", count: upcoming.length },
          { id: "past" as const, label: "Past", count: past.length },
        ]}
        active={tab}
        hrefFor={(id) => (id === "upcoming" ? ROUTES.events : `${ROUTES.events}?tab=past`)}
      />
      {loading ? (
        <FeedSkeleton count={2} />
      ) : error ? (
        <ErrorState title="Couldn't load events" message={error.message} onRetry={() => void refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === "upcoming" ? "No upcoming events" : "No past events"}
          description="Organising a clean-up, residents' meeting or party? Invite your neighbours."
          action={
            <Button size="sm" onClick={() => openComposer("event")}>
              Create event
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <EventCard key={p._id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
