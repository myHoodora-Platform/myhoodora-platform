"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, CheckCircle2, HandHeart, MapPin, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { PhotoGallery } from "@/components/shared/photo-gallery";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { formatEventDate, formatNaira, pluralize } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Post, ReactionType } from "@/lib/api/types";
import { alertStatus } from "@/features/alerts/lifecycle";
import { EventPhaseChip } from "@/features/events/event-phase-chip";
import { alertCategoryDef, categoryDef, reactionDef } from "../categories";
import { shareLink } from "../share";
import { PollCard } from "./poll-card";
import { PostMenu } from "./post-menu";
import { ReactionButton } from "./reaction-button";

const CLAMP_CHARS = 320;

interface PostCardProps {
  post: Post;
  onReact: (post: Post, type: ReactionType | null) => Promise<unknown>;
  onDelete: (postId: string) => Promise<void>;
  /** "detail" = the /p/[id] page: full text, no link-through. */
  variant?: "feed" | "detail";
}

export function PostCard({ post, onReact, onDelete, variant = "feed" }: PostCardProps) {
  const { user } = useAuth();
  const viewer = useViewer();
  const author = resolveAuthor(post.authorUid, viewer);
  const isOwn = !!user && post.authorUid === user.uid;
  const { meta } = post;
  const isAlert = meta.category === "alert";
  const status = isAlert ? alertStatus(post) : null;
  const urgent = status === "urgent";
  const over = status === "resolved" || status === "ended";
  const alertDef = isAlert ? alertCategoryDef(meta.alertCategory) : null;
  const category = categoryDef(meta.category);

  const [expanded, setExpanded] = useState(variant === "detail");
  const isLong = post.message.length > CLAMP_CHARS;
  const postHref = ROUTES.post(post._id);

  return (
    <article
      aria-labelledby={`post-${post._id}-author`}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-xs",
        urgent && "border-destructive/40 ring-1 ring-destructive/20",
      )}
    >
      {alertDef && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold sm:px-5",
            over ? "bg-muted text-muted-foreground" : alertDef.tone,
          )}
        >
          <alertDef.icon className="size-4" aria-hidden />
          {alertDef.label}
          {urgent && <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[11px] text-white">Urgent</span>}
          {status === "resolved" && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">
              <CheckCircle2 className="size-3" aria-hidden /> Resolved {post.resolvedAt && timeAgo(post.resolvedAt)}
            </span>
          )}
          {status === "ended" && <span className="ml-auto text-[11px] font-semibold">Ended</span>}
        </div>
      )}

      <div className="space-y-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={ROUTES.profile(post.authorUid)} className="shrink-0" tabIndex={-1} aria-hidden>
            <UserAvatar person={author} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[15px] font-bold text-foreground" id={`post-${post._id}-author`}>
              <Link href={ROUTES.profile(post.authorUid)} className="truncate hover:underline">
                {author.displayName}
              </Link>
              {author.kind === "organisation" && (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Official organisation" />
              )}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              {[author.neighborhoodName, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}
              {!isAlert && meta.category !== "general" && (
                <>
                  {" · "}
                  <span className="font-semibold text-foreground/70">{category.badge}</span>
                </>
              )}
            </p>
          </div>
          <PostMenu
            post={post}
            isOwn={isOwn}
            onDelete={onDelete}
            redirectAfterDelete={variant === "detail" ? ROUTES.newsFeed : undefined}
          />
        </div>

        {/* Category-specific header */}
        {meta.category === "thanks" && meta.thankedName && (
          <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold">
            <HandHeart className="size-4 shrink-0 text-brand-coral" aria-hidden />
            Thanking {meta.thankedName}
          </p>
        )}
        {meta.category === "event" && (meta.eventDate || meta.eventLocation) && (
          <div className="space-y-1 rounded-xl bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary">
            {meta.eventDate && (
              <p className="flex flex-wrap items-center gap-2">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                {formatEventDate(meta.eventDate)}
                <EventPhaseChip eventDate={meta.eventDate} />
              </p>
            )}
            {meta.eventLocation && (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {meta.eventLocation}
              </p>
            )}
          </div>
        )}
        {meta.category === "for_sale" && meta.priceNaira !== undefined && (
          <p className="text-lg font-bold text-foreground">{formatNaira(meta.priceNaira)}</p>
        )}

        {/* Body (for polls, the question) */}
        <div
          className={cn(
            "text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90",
            meta.category === "poll" && "font-semibold text-foreground",
          )}
        >
          {expanded || !isLong ? post.message : `${post.message.slice(0, CLAMP_CHARS).trimEnd()}… `}
          {!expanded && isLong && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-semibold text-primary hover:underline"
            >
              see more
            </button>
          )}
        </div>

        {meta.category === "poll" && <PollCard post={post} />}
      </div>

      <PhotoGallery urls={post.mediaUrls} className="border-y border-border" />

      {/* Counts */}
      {(post.reactionTotal > 0 || post.commentCount > 0) && (
        <div className="flex items-center justify-between px-4 pt-1 text-[13px] text-muted-foreground sm:px-5">
          <span>
            {post.reactionTotal > 0 &&
              `${post.myReaction ? reactionDef(post.myReaction).emoji : "👍"} ${post.reactionTotal}`}
          </span>
          {post.commentCount > 0 && (
            <Link href={`${postHref}#comments`} className="hover:underline">
              {pluralize(post.commentCount, "comment")}
            </Link>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-1 flex items-center gap-1 border-t border-border px-2 py-1 sm:px-3">
        <ReactionButton post={post} onReact={onReact} />
        <Link
          href={`${postHref}#comments`}
          className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          <MessageCircle className="size-[18px]" aria-hidden />
          Comment
        </Link>
        <button
          type="button"
          onClick={() => void shareLink(postHref, post.message)}
          className="ml-auto flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          <Share2 className="size-[18px]" aria-hidden />
          <span className="hidden sm:inline">Share</span>
          <span className="sr-only sm:hidden">Share</span>
        </button>
      </div>
    </article>
  );
}
