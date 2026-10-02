"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/features/feed/feed-context";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PostCard } from "@/features/feed/components/post-card";
import * as postsApi from "@/lib/api/posts";
import { errorMessage } from "@/lib/api/client";
import { ROUTES } from "@/lib/routes";
import type { Post, ReactionType } from "@/lib/api/types";
import { RsvpButtons } from "@/features/events/rsvp-buttons";
import { calendarFor, eventPhase } from "@/features/events/event-time";
import { CommentsSection } from "./comments-section";

/** /p/[id] — a post's own page: what gets shared, and where comments live. */
export function PostPage({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const feed = useFeed();
  const fromFeed = feed.posts.find((p) => p._id === postId);
  const [fetched, setFetched] = useState<Post | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    fromFeed ? "ready" : "loading",
  );
  const [error, setError] = useState<string | null>(null);
  // The feed copy stays authoritative when present so reactions stay in sync.
  const post = fromFeed ?? fetched;

  useEffect(() => {
    if (fromFeed || !user || !profile?.neighborhoodId) return;
    let cancelled = false;
    setStatus("loading");
    postsApi
      .getPost(user, profile.neighborhoodId, postId)
      .then((p) => {
        if (cancelled) return;
        setFetched(p);
        setStatus(p ? "ready" : "missing");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err, "Couldn't load this post."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Only refetch when the target changes, not on every feed update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.neighborhoodId, postId]);

  const react = async (p: Post, type: ReactionType | null) => {
    if (fromFeed) return feed.react(p, type);
    if (!user) return;
    setFetched({ ...p, myReaction: type });
    setFetched(await postsApi.setReaction(user, p, type));
  };

  const setCommentCount = (commentCount: number) => {
    if (!post) return;
    const next = { ...post, commentCount };
    if (fromFeed) feed.upsertPost(next);
    else setFetched(next);
  };

  const more = feed.posts.filter((p) => p._id !== postId).slice(0, 3);

  return (
    <div className="space-y-4">
      <BackLink fallback={ROUTES.newsFeed} />
      {status === "loading" && !post ? (
        <FeedSkeleton count={1} />
      ) : status === "error" ? (
        <ErrorState title="Couldn't load this post" message={error ?? ""} onRetry={() => window.location.reload()} />
      ) : !post ? (
        <EmptyState
          icon={FileQuestion}
          title="This post isn't available"
          description="It may have been deleted, or it was shared with a different neighbourhood."
          action={
            <Button size="sm" onClick={() => (window.location.href = ROUTES.newsFeed)}>
              Go to your feed
            </Button>
          }
        />
      ) : (
        <>
          <h1 className="sr-only">Post</h1>
          <PostCard post={post} onReact={react} onDelete={feed.deletePost} variant="detail" />
          {post.meta.category === "event" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold">{eventPhase(post.meta.eventDate) === "ended" ? "This event has ended" : "Are you going?"}</p>
              <RsvpButtons postId={post._id} eventDate={post.meta.eventDate} calendar={calendarFor(post)} />
            </div>
          )}
          <CommentsSection postId={post._id} onCountChange={setCommentCount} />
          {more.length > 0 && (
            <section aria-labelledby="more-heading" className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 id="more-heading" className="text-base font-bold">
                  More from your neighbourhood
                </h2>
                <Link href={ROUTES.newsFeed} className="text-sm font-semibold text-primary hover:underline">
                  See all
                </Link>
              </div>
              {more.map((p) => (
                <PostCard key={p._id} post={p} onReact={feed.react} onDelete={feed.deletePost} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
