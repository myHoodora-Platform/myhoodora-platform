"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicPostPreview } from "@myhoodora/api-contract/types";
import { BadgeCheck, CalendarDays, Lock, MapPin, MessageCircle, Smartphone, ThumbsUp, X } from "lucide-react";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { cn } from "@myhoodora/ui/utils";
import { imageUrl } from "@/lib/media/media-url";
import { postKindWords } from "@/lib/api/public-posts";
import { timeAgo } from "@/lib/time";
import { formatEventDate, formatNaira, pluralize } from "@/lib/format";
import { rememberSharedVisit, openInAppHref, inAppBrowser } from "./shared-visit";

/**
 * A shared post for someone not signed in (docs/product/hood-activation-plan.md §8). Like Facebook's
 * "See more on Facebook": the post (full for Anyone posts, a teaser otherwise) sits faded behind a
 * card to log in or join. On a full post they can read first; the card comes when they try to take
 * part or reach the end. On a teaser it comes straight away.
 */
export function SharedPostView({ post, postId, refCode }: { post: PublicPostPreview | null; postId: string; refCode?: string }) {
  const full = post?.mode === "full";
  const [card, setCard] = useState(!full);
  const [dismissed, setDismissed] = useState(false);
  const [appLink, setAppLink] = useState<string | null>(null);
  const [webview, setWebview] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rememberSharedVisit({ postId, hoodName: post?.hood.name, ref: refCode });
    setAppLink(openInAppHref(`p/${postId}`, navigator.userAgent));
    setWebview(inAppBrowser(navigator.userAgent));
  }, [postId, post?.hood.name, refCode]);

  // Reading to the end of a full post brings the card up once (Facebook does it on scroll).
  useEffect(() => {
    if (!full || dismissed || !end.current) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setCard(true), { rootMargin: "0px 0px -20% 0px" });
    io.observe(end.current);
    return () => io.disconnect();
  }, [full, dismissed]);

  const next = encodeURIComponent(`/p/${postId}`);
  const join = `/register${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;
  const login = `/login?next=${next}`;
  const ask = () => setCard(true);
  const hoodName = post?.hood.name ?? "your neighbourhood";

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="myHoodora home">
            <MascotWordmark className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href={login} className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
              Log in
            </Link>
            <Link href={join} className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Join
            </Link>
          </div>
        </div>
      </header>

      {webview && (
        <p className="mx-auto max-w-2xl px-4 pt-3 text-center text-xs text-muted-foreground">For the best experience, open this link in your browser or the myHoodora app.</p>
      )}

      <main className={cn("mx-auto max-w-2xl px-4 py-6 transition", card && !dismissed && "pointer-events-none opacity-40 blur-[1px]")} aria-hidden={card && !dismissed}>
        {post ? <PostBody post={post} onAct={ask} /> : <Unavailable />}
        <div ref={end} className="h-px" />
      </main>

      {/* Full posts: a bar to join while they read; the card when they act or reach the end. */}
      {full && (!card || dismissed) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">Join {hoodName} on myHoodora</span>
              <span className="block text-muted-foreground">Free, for verified neighbours.</span>
            </p>
            <Link href={join} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              Join
            </Link>
          </div>
        </div>
      )}

      {card && !dismissed && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/20 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="see-more-title">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-2xl sm:p-8">
            {full && (
              <button type="button" onClick={() => setDismissed(true)} className="absolute top-3 right-3 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Keep reading">
                <X className="size-5" />
              </button>
            )}
            <h2 id="see-more-title" className="text-2xl font-extrabold tracking-tight">
              See more on myHoodora
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {full
                ? `Join ${hoodName}'s neighbours to reply, react and see what's happening near you.`
                : `This was shared by a neighbour in ${hoodName}. Only verified neighbours there can read it. Join to find your own neighbourhood.`}
            </p>
            <div className="mt-6 space-y-3">
              <Link href={login} className="block w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground hover:bg-primary/90">
                Log in
              </Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Link href={join} className="mx-auto block w-full max-w-xs rounded-xl bg-[#2e7d32] py-3 text-base font-bold text-white hover:bg-[#276b2b]">
                Create new account
              </Link>
              {appLink && (
                <a href={appLink} className="inline-flex items-center gap-2 pt-1 text-sm font-semibold text-primary hover:underline">
                  <Smartphone className="size-4" aria-hidden /> Open in the myHoodora app
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostBody({ post, onAct }: { post: PublicPostPreview; onAct: () => void }) {
  const team = post.author.kind === "team";
  const full = post.mode === "full";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {team ? "HT" : full ? post.author.name.replace(/\W/g, "") || "N" : <Lock className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-bold">
              {full ? post.author.name : `A neighbour in ${post.hood.name}`}
              {team && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <BadgeCheck className="size-3.5" aria-hidden /> Official · Hood Team
                </span>
              )}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {post.hood.name}
              {post.hood.city ? `, ${post.hood.city}` : ""} · {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>

        {full ? (
          <>
            {post.message && <p className="text-[15px] whitespace-pre-wrap">{post.message}</p>}
            {post.eventDate && (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden /> {formatEventDate(post.eventDate)}
                </span>
                {post.eventLocation && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden /> {post.eventLocation}
                  </span>
                )}
              </p>
            )}
            {post.priceNaira !== undefined && post.priceNaira !== null && <p className="text-lg font-bold">{post.priceNaira === 0 ? "Free" : formatNaira(post.priceNaira)}</p>}
            {post.mediaUrls?.length ? (
              <div className={cn("grid gap-1 overflow-hidden rounded-xl", post.mediaUrls.length > 1 && "grid-cols-2")}>
                {post.mediaUrls.slice(0, 4).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-sized already
                  <img key={url} src={imageUrl(url, { width: 640 })} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ))}
              </div>
            ) : null}
            {post.poll && (
              <ul className="space-y-2">
                {post.poll.options.map((o) => {
                  const n = post.pollResults?.counts[o.id] ?? 0;
                  const pct = post.pollResults?.total ? Math.round((n / post.pollResults.total) * 100) : 0;
                  return (
                    <li key={o.id}>
                      <button type="button" onClick={onAct} className="relative w-full overflow-hidden rounded-lg border border-border px-3 py-2 text-left text-sm">
                        <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} aria-hidden />
                        <span className="relative flex justify-between gap-3">
                          <span>{o.text}</span>
                          <span className="tabular-nums text-muted-foreground">{pct}%</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="text-xs text-muted-foreground">{pluralize(post.pollResults?.total ?? 0, "vote")} · join to vote</li>
              </ul>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-muted/60 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Lock className="size-4 text-muted-foreground" aria-hidden /> {postKindWords(post.category).replace(/^./, (c) => c.toUpperCase())} for {post.hood.name} neighbours
            </p>
            <p className="mt-1 text-muted-foreground">Only verified neighbours in {post.hood.name} can read it. Join myHoodora to see what&apos;s happening in your own neighbourhood.</p>
            <div className="mt-3 space-y-2" aria-hidden>
              <span className="block h-3 w-11/12 rounded bg-muted-foreground/15" />
              <span className="block h-3 w-9/12 rounded bg-muted-foreground/15" />
              <span className="block h-3 w-10/12 rounded bg-muted-foreground/15" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1 text-sm text-muted-foreground">
        <button type="button" onClick={onAct} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-semibold hover:bg-muted">
          <ThumbsUp className="size-4" aria-hidden /> {post.reactionTotal ? post.reactionTotal : "Like"}
        </button>
        <button type="button" onClick={onAct} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-semibold hover:bg-muted">
          <MessageCircle className="size-4" aria-hidden /> {post.commentCount ? pluralize(post.commentCount, "reply", "replies") : "Reply"}
        </button>
      </div>

      {full && post.replies && post.replies.length > 0 && (
        <ul className="space-y-3 border-t border-border p-5">
          {post.replies.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{r.kind === "team" ? "HT" : r.name.replace(/\W/g, "")}</span>
              <div className="min-w-0 rounded-2xl bg-muted px-3.5 py-2 text-sm">
                <p className="font-bold">{r.name}</p>
                <p className="whitespace-pre-wrap">{r.text}</p>
              </div>
            </li>
          ))}
          {post.commentCount > post.replies.length && (
            <li>
              <button type="button" onClick={onAct} className="text-sm font-semibold text-primary hover:underline">
                See all {pluralize(post.commentCount, "reply", "replies")}
              </button>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function Unavailable() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-lg font-bold">This post isn&apos;t available</p>
      <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Join myHoodora to see what&apos;s happening in your neighbourhood.</p>
    </div>
  );
}
