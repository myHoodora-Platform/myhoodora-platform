"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search as SearchIcon, SearchX } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/features/feed/feed-context";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PostCard } from "@/features/feed/components/post-card";
import { ListingCard } from "@/features/for-sale/listing-card";
import { errorMessage } from "@/lib/api/client";
import * as postsApi from "@/lib/api/posts";
import { searchHood, type HoodSearchResults, type SearchType } from "@/lib/api/search";
import type { Post, ReactionType } from "@/lib/api/types";
import { ROUTES } from "@/lib/routes";

const TABS: { id: SearchType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "listings", label: "For Sale & Free" },
  { id: "people", label: "Neighbours" },
];

/** /search?q&type: search your Hood, Nextdoor-style (All · Posts · For Sale · Neighbours). */
export function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const feed = useFeed();
  const q = (params.get("q") ?? "").trim();
  const typeParam = params.get("type");
  const type = TABS.some((t) => t.id === typeParam && t.id !== "all") ? (typeParam as SearchType) : undefined;
  const [draft, setDraft] = useState(q);
  const [results, setResults] = useState<HoodSearchResults | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const hoodId = profile?.neighborhoodId;

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    if (!user || !hoodId || q.length < 2) return setResults(null);
    let cancelled = false;
    setStatus("loading");
    searchHood(user, hoodId, q, type)
      .then((r) => !cancelled && (setResults(r), setStatus("idle")))
      .catch((err) => !cancelled && (setError(errorMessage(err, "Search isn't working right now.")), setStatus("error")));
    return () => {
      cancelled = true;
    };
  }, [user, hoodId, q, type]);

  const go = (next: { q?: string; type?: SearchType | "all" }) => {
    const nextType = next.type === undefined ? type : next.type === "all" ? undefined : next.type;
    router.push(ROUTES.search(next.q ?? q, nextType));
  };

  const react = async (post: Post, reaction: ReactionType | null) => {
    if (!user) return;
    const updated = await postsApi.setReaction(user, post, reaction);
    setResults((r) => r && { ...r, posts: r.posts?.map((p) => (p._id === updated._id ? updated : p)) });
    feed.upsertPost(updated);
  };
  const remove = async (postId: string) => {
    await feed.deletePost(postId);
    setResults((r) => r && { ...r, posts: r.posts?.filter((p) => p._id !== postId) });
  };

  const empty = results && !results.posts?.length && !results.listings?.length && !results.people?.length;

  return (
    <div className="space-y-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim().length >= 2) go({ q: draft.trim() });
        }}
        // Phones only: on desktop the header box is the search box.
        className="flex h-12 items-center gap-3 rounded-full border border-border bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 md:hidden"
      >
        <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          aria-label="Search your neighbourhood"
          type="search"
          autoFocus={!q}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
          placeholder="Search posts, items for sale and neighbours"
          className="h-full w-full bg-transparent text-[15px] outline-none"
        />
      </form>

      <h1 className="text-xl font-bold">{q.length >= 2 ? <>Results for “{q}”</> : "Search"}</h1>

      <div role="tablist" aria-label="Result type" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = (type ?? "all") === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => go({ type: t.id })}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!hoodId ? (
        <EmptyState icon={SearchIcon} title="Search opens once you've joined a neighbourhood" description="Verify your address to search posts, items for sale and neighbours near you." />
      ) : q.length < 2 ? (
        <EmptyState icon={SearchIcon} title="Search your neighbourhood" description="Try “plumber”, “generator”, “lost cat” or a neighbour's name." />
      ) : status === "loading" && !results ? (
        <FeedSkeleton count={2} />
      ) : status === "error" ? (
        <ErrorState title="Search didn't work" message={error} onRetry={() => router.refresh()} />
      ) : empty ? (
        <EmptyState icon={SearchX} title={`No results for “${q}”`} description="Check the spelling, or try a shorter or different word." />
      ) : results ? (
        <div className={cn("space-y-6", status === "loading" && "opacity-60")}>
          {!!results.posts?.length && (
            <Section title="Posts" more={!type && results.posts.length >= 5 ? () => go({ type: "posts" }) : undefined}>
              <div className="space-y-3">
                {results.posts.map((p) => (
                  <PostCard key={p._id} post={p} onReact={react} onDelete={remove} />
                ))}
              </div>
            </Section>
          )}
          {!!results.listings?.length && (
            <Section title="For Sale & Free" more={!type && results.listings.length >= 5 ? () => go({ type: "listings" }) : undefined}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {results.listings.map((l) => (
                  <ListingCard key={l._id} listing={l} />
                ))}
              </div>
            </Section>
          )}
          {!!results.people?.length && (
            <Section title="Neighbours" more={!type && results.people.length >= 5 ? () => go({ type: "people" }) : undefined}>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {results.people.map((n) => (
                  <li key={n.uid}>
                    <Link href={ROUTES.profile(n.uid)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                      <UserAvatar person={n} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{n.displayName}</span>
                        {n.neighborhoodName && <span className="block text-xs text-muted-foreground">{n.neighborhoodName}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, more, children }: { title: string; more?: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        {more && (
          <button type="button" onClick={more} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            See all <ArrowRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
