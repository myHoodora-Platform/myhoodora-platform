"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Flag, MessageCircle, SendHorizontal, Trash2 } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { ReportDialog } from "@/components/shared/report-dialog";
import { PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { addComment, deleteComment, listComments } from "@/lib/api/comments";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Comment } from "@/lib/api/types";
import { needsKindnessReminder } from "@/features/feed/kindness";

interface CommentsSectionProps {
  postId: string;
  onCountChange: (count: number) => void;
}

export function CommentsSection({ postId, onCountChange }: CommentsSectionProps) {
  const { user, runGatedAction } = useAuth();
  const viewer = useViewer();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [kindness, setKindness] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    listComments(user, postId)
      .then(setComments)
      .catch((err) => setError(errorMessage(err, "Couldn't load comments.")));
  }, [user, postId]);

  // Arriving via "Comment" (…#comments) focuses the box.
  useEffect(() => {
    if (window.location.hash === "#comments") inputRef.current?.focus({ preventScroll: false });
  }, [comments]);

  const send = () => {
    const content = draft.trim();
    if (!user || !content) return;
    if (!kindness && needsKindnessReminder(content)) {
      setKindness(true);
      return;
    }
    runGatedAction(async () => {
      setSending(true);
      try {
        const created = await addComment(user, postId, content);
        const next = [...(comments ?? []), created];
        setComments(next);
        onCountChange(next.length);
        setDraft("");
        setKindness(false);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't post your comment."));
      } finally {
        setSending(false);
      }
    });
  };

  const remove = async (id: string) => {
    if (!user || !comments) return;
    const previous = comments;
    const next = comments.filter((c) => c._id !== id);
    setComments(next);
    onCountChange(next.length);
    try {
      await deleteComment(user, id);
    } catch (err) {
      setComments(previous);
      onCountChange(previous.length);
      toast.error(errorMessage(err, "Couldn't delete the comment."));
    }
  };

  const me = user ? resolveAuthor(user.uid, viewer) : null;

  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 id="comments-heading" className="flex items-center gap-2 text-base font-bold">
        <MessageCircle className="size-5 text-primary" aria-hidden />
        Comments {comments && comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
      </h2>
      <PreviewNotice endpoint="comments" />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : comments === null ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const author = resolveAuthor(c.authorUid, viewer);
            const isOwn = c.authorUid === user?.uid;
            return (
              <li key={c._id} className="flex gap-3">
                <Link href={ROUTES.profile(c.authorUid)} tabIndex={-1} aria-hidden>
                  <UserAvatar person={author} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-muted px-3.5 py-2.5">
                    <Link href={ROUTES.profile(c.authorUid)} className="text-sm font-bold hover:underline">
                      {author.displayName}
                    </Link>
                    <p className="text-[15px] whitespace-pre-wrap text-foreground/90">{c.content}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted-foreground">
                    <span>{timeAgo(c.createdAt)}</span>
                    {isOwn ? (
                      <button type="button" onClick={() => void remove(c._id)} className="inline-flex items-center gap-1 font-semibold hover:text-destructive">
                        <Trash2 className="size-3" aria-hidden /> Delete
                      </button>
                    ) : (
                      <button type="button" onClick={() => setReporting(c._id)} className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
                        <Flag className="size-3" aria-hidden /> Report
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-3 border-t border-border pt-4"
      >
        {me && <UserAvatar person={me} size="sm" />}
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="comment-input" className="sr-only">
            Write a comment
          </label>
          <textarea
            id="comment-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setKindness(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Add a comment…"
            className="max-h-40 min-h-11 w-full resize-y rounded-2xl border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
          {kindness && (
            <p role="alert" className="text-xs font-semibold text-warning">
              This might come across as hurtful. Edit it, or press send again to post anyway.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send comment"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
            (!draft.trim() || sending) && "opacity-40",
          )}
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </form>

      <ReportDialog
        open={reporting !== null}
        onOpenChange={(o) => !o && setReporting(null)}
        target={{ targetType: "comment", targetId: reporting ?? "" }}
      />
    </section>
  );
}
