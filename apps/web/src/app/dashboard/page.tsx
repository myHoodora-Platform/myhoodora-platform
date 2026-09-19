"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FacebookSelector, icons as reactionIcons } from "@charkour/react-reactions";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/context/FeedContext";
import { useRequireOnboarded } from "@/hooks/use-require-onboarded";
import { resolveAuthor } from "@/lib/feed/author-provider";
import { uploadImageFile, resolveImageUrl } from "@/lib/feed/media-provider";
import {
  encodeEventContent,
  decodeEventContent,
  formatEventDate,
} from "@/lib/feed/event-meta";
import { timeAgo } from "@/lib/time";
import type { Post, PostType } from "@/lib/firebase/posts";
import { ConfirmOverlay } from "@/components/shared/confirm-overlay";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { Button } from "@myhoodora/ui/button";
import { Textarea } from "@myhoodora/ui/textarea";
import { Badge } from "@myhoodora/ui/badge";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@myhoodora/ui/avatar";
import { cn } from "@myhoodora/ui/utils";
import {
  MessageSquare,
  Share2,
  ImageIcon,
  Link2,
  Loader2,
  Trash2,
  X,
  Sparkles,
  CalendarDays,
  AlertTriangle,
  MapPin,
  ChevronDown,
} from "lucide-react";

const POST_TYPE_LABELS: Record<PostType, string> = {
  text: "General",
  event: "Event",
  alert: "Alert",
  image: "Photo",
};

const POST_TYPE_STYLES: Record<PostType, string> = {
  text: "bg-slate-100 text-slate-700",
  event: "bg-sky-100 text-sky-700",
  alert: "bg-rose-100 text-rose-700",
  image: "bg-violet-100 text-violet-700",
};

const POST_TYPE_ICONS: Record<PostType, React.ElementType> = {
  text: Sparkles,
  event: CalendarDays,
  alert: AlertTriangle,
  image: ImageIcon,
};

const REACTION_LABELS: Record<string, string> = {
  like: "👍 Like",
  love: "❤️ Love",
  haha: "😂 Haha",
  wow: "😮 Wow",
  sad: "😢 Sad",
  angry: "😡 Angry",
};

function reactionIconFor(emoji: string): string {
  return reactionIcons.find("facebook", emoji);
}

/**
 * The backend only records *whether* a uid reacted (`likes: string[]`), not
 * *which* emoji they picked — there's nowhere to store reaction type yet
 * (tracked in apps/api/README.md TODOs). So only the viewer's own choice is
 * remembered, locally, per device; the aggregate is an honest total count.
 */
function useOwnReactionEmoji(postId: string) {
  const [emoji, setEmoji] = useState<string>(() => {
    if (typeof window === "undefined") return "like";
    try {
      return window.localStorage.getItem(`reaction:${postId}`) || "like";
    } catch {
      return "like";
    }
  });

  const persist = (next: string) => {
    setEmoji(next);
    try {
      window.localStorage.setItem(`reaction:${postId}`, next);
    } catch {
      // Best-effort only — a private browsing session can throw here.
    }
  };

  return [emoji, persist] as const;
}

/**
 * Click/tap-driven, not hover-driven — hover doesn't exist on touch devices
 * (the picker would simply be unreachable there), and even on desktop a
 * hover-reveal forces the pointer through a race between leaving the button
 * and landing on the popup. A dedicated caret opens a real popover that
 * behaves identically on mouse and touch: it stays open until an emoji is
 * picked, the user clicks outside, or presses Escape.
 */
function ReactionButton({ post }: { post: Post }) {
  const { user } = useAuth();
  const { toggleLike } = useFeed();
  const [open, setOpen] = useState(false);
  const [myEmoji, persistEmoji] = useOwnReactionEmoji(post._id);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasReacted = !!user && post.likes.includes(user.uid);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: Event) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleQuickToggle = () => {
    toggleLike(post._id).catch(() =>
      toast.error("Failed to update your reaction."),
    );
  };

  const handleSelect = (emoji: string) => {
    setOpen(false);
    persistEmoji(emoji);
    if (!hasReacted) {
      toggleLike(post._id).catch(() =>
        toast.error("Failed to update your reaction."),
      );
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        onClick={handleQuickToggle}
        title={hasReacted ? REACTION_LABELS[myEmoji] : "React"}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-colors",
          hasReacted
            ? "font-bold text-primary"
            : "text-slate-400 hover:text-primary",
        )}
      >
        {hasReacted ? (
          // eslint-disable-next-line @next/next/no-img-element -- small base64 emoji icon, not a real remote image
          <img src={reactionIconFor(myEmoji)} alt={myEmoji} className="size-4" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- small base64 emoji icon, not a real remote image
          <img src={reactionIconFor("like")} alt="like" className="size-4 opacity-50" />
        )}
        {post.likes.length > 0 ? post.likes.length : "React"}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Choose a reaction"
        className="ml-0.5 flex size-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
      >
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-20 mt-2 animate-in fade-in zoom-in-95 duration-150"
        >
          <FacebookSelector iconSize={32} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}

function shareUrlFor(postId: string): string {
  return `${window.location.origin}/dashboard?post=${postId}`;
}

async function handleShare(post: Post, message: string) {
  const url = shareUrlFor(post._id);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "myHoodora",
        text: message.slice(0, 120),
        url,
      });
    } catch (err) {
      // AbortError is the user cancelling the native share sheet — not an error.
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Couldn't share this post.");
      }
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard.");
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

function PostCard({
  post,
  highlighted,
}: {
  post: Post;
  highlighted: boolean;
}) {
  const { user, profile } = useAuth();
  const { deletePost } = useFeed();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const author = resolveAuthor(post.authorUid, { user, profile });
  const TypeIcon = POST_TYPE_ICONS[post.type];
  const isOwn = !!user && post.authorUid === user.uid;
  const { message, meta } =
    post.type === "event"
      ? decodeEventContent(post.content)
      : { message: post.content, meta: null };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePost(post._id);
      toast.success("Post deleted.");
      setConfirmingDelete(false);
    } catch {
      toast.error("Failed to delete post.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      id={`post-${post._id}`}
      className={cn(
        "space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow",
        post.type === "alert" && "border-l-4 border-l-rose-400 bg-rose-50/20",
        highlighted && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar>
            {author.photoURL && <AvatarImage src={author.photoURL} alt={author.displayName} />}
            <AvatarFallback>{author.initials}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {author.displayName}
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("gap-1", POST_TYPE_STYLES[post.type])}>
            <TypeIcon className="size-3" />
            {POST_TYPE_LABELS[post.type]}
          </Badge>
          {isOwn && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete post"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {meta && (meta.date || meta.location) && (
        <div className="flex flex-col gap-1 rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
          {meta.date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatEventDate(meta.date)}
            </span>
          )}
          {meta.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {meta.location}
            </span>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
        {message}
      </p>

      {post.mediaUrls[0] && (
        <ImageWithFallback
          src={post.mediaUrls[0]}
          alt=""
          className="max-h-96 w-full rounded-xl border border-slate-100 object-cover"
        />
      )}

      <div className="flex items-center gap-6 border-t border-slate-100 pt-3 text-slate-400">
        <ReactionButton post={post} />
        <button
          disabled
          title="Comments are coming soon"
          className="flex cursor-not-allowed items-center gap-1.5 text-xs opacity-40"
        >
          <MessageSquare className="size-4" />
          Comment
        </button>
        <button
          onClick={() => void handleShare(post, message)}
          title="Share"
          className="ml-auto flex items-center gap-1.5 text-xs transition-colors hover:text-slate-600"
        >
          <Share2 className="size-4" />
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmOverlay
          icon={Trash2}
          title="Delete this post?"
          description="This removes it from the neighborhood feed for everyone."
          confirmLabel={deleting ? "Deleting..." : "Delete post"}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </article>
  );
}

function PostComposer() {
  const { user, runGatedAction } = useAuth();
  const { createPost } = useFeed();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<PostType>("text");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url" | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setContent("");
    setType("text");
    setEventDate("");
    setEventLocation("");
    setImageInputMode(null);
    setImageUrlInput("");
    setImagePreviewUrl(null);
    setExpanded(false);
  };

  const handleTypeSelect = (next: PostType) => {
    setType(next);
    if (next !== "image") {
      setImageInputMode(null);
      setImagePreviewUrl(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const url = await uploadImageFile(user, file);
      setImagePreviewUrl(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUrlConfirm = () => {
    try {
      setImagePreviewUrl(resolveImageUrl(imageUrlInput));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid image URL.");
    }
  };

  const submit = async () => {
    if (!content.trim()) {
      toast.error("Write something to share first.");
      return;
    }
    if (type === "image" && !imagePreviewUrl) {
      toast.error("Add a photo or paste an image URL first.");
      return;
    }
    setSubmitting(true);
    try {
      const finalContent =
        type === "event"
          ? encodeEventContent(content.trim(), {
              date: eventDate || undefined,
              location: eventLocation.trim() || undefined,
            })
          : content.trim();
      await createPost({
        content: finalContent,
        type,
        mediaUrl: imagePreviewUrl ?? undefined,
      });
      toast.success("Posted to your neighborhood feed.");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    runGatedAction(() => {
      void submit();
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-slate-100/70"
        >
          What&apos;s going on in the neighborhood?
        </button>
      ) : (
        <>
          <Textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share an update, a question, or a heads up..."
            className="min-h-24"
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => {
              const Icon = POST_TYPE_ICONS[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeSelect(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? POST_TYPE_STYLES[t] + " border-transparent"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <Icon className="size-3.5" />
                  {POST_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          {type === "event" && (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Date &amp; time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Location (optional)
                </label>
                <input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Main gate, Ikeja"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {type === "image" && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              {imagePreviewUrl ? (
                <div className="relative">
                  <ImageWithFallback
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="max-h-64 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setImagePreviewUrl(null)}
                    className="absolute top-2 right-2 rounded-full bg-slate-900/60 p-1 text-white hover:bg-slate-900/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="size-3.5" />
                    )}
                    Upload a photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setImageInputMode((m) => (m === "url" ? null : "url"))
                    }
                  >
                    <Link2 className="size-3.5" />
                    Paste image URL
                  </Button>
                </div>
              )}

              {!imagePreviewUrl && imageInputMode === "url" && (
                <div className="flex gap-2">
                  <input
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <Button type="button" size="sm" onClick={handleUrlConfirm}>
                    Preview
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Post
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardFeedPageContent() {
  useRequireOnboarded();
  const { posts, loading, loadingMore, hasMore, loadMore } = useFeed();
  const searchParams = useSearchParams();
  const targetPostId = searchParams.get("post");
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null,
  );
  const attemptedLoadMoreFor = useRef<string | null>(null);

  // Alert posts are pinned above everything else — a filter/filter split
  // preserves each group's own newest-first order rather than a full resort.
  const sortedPosts = useMemo(() => {
    const alerts = posts.filter((p) => p.type === "alert");
    const rest = posts.filter((p) => p.type !== "alert");
    return [...alerts, ...rest];
  }, [posts]);

  useEffect(() => {
    if (!targetPostId || loading) return;

    const found = posts.some((p) => p._id === targetPostId);
    if (found) {
      setHighlightedPostId(targetPostId);
      document
        .getElementById(`post-${targetPostId}`)
        ?.scrollIntoView({ behavior: "instant", block: "center" });
      const timer = setTimeout(() => setHighlightedPostId(null), 2500);
      return () => clearTimeout(timer);
    }

    // Shared post isn't in the loaded page yet — page back through older
    // posts (bounded, so a stale/invalid link can't loop forever).
    if (hasMore && attemptedLoadMoreFor.current !== targetPostId) {
      attemptedLoadMoreFor.current = targetPostId;
      void loadMore();
    }
  }, [targetPostId, posts, loading, hasMore, loadMore]);

  return (
    <div className="space-y-6">
      <PostComposer />

      {loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-700">No posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to share something with your neighbors.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              highlighted={highlightedPostId === post._id}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardFeedPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <DashboardFeedPageContent />
    </Suspense>
  );
}
