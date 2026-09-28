"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Flag, SendHorizontal } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { getConversation, listMessages, sendMessage } from "@/lib/api/chat";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { formatNaira } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Conversation, Message } from "@/lib/api/types";
import { otherParticipant } from "./conversation-list";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

export function ConversationThread({ id }: { id: string }) {
  const { user } = useAuth();
  const viewer = useViewer();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [convo, setConvo] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(() => params.get("draft") ?? "");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    void Promise.all([getConversation(user, id), listMessages(user, id)])
      .then(([c, m]) => {
        setConvo(c);
        setMessages(m);
      })
      .catch(() => setConvo(null));
  }, [user, id]);

  useEffect(() => {
    if (params.has("draft")) router.replace(pathname, { scroll: false });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (convo) inputRef.current?.focus();
  }, [convo]);

  if (convo === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="ml-auto h-10 w-56 rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-2xl" />
      </div>
    );
  }
  if (convo === null || !user) {
    return <p className="p-6 text-center text-sm text-muted-foreground">This conversation isn&apos;t available.</p>;
  }

  const otherUid = otherParticipant(convo, user.uid);
  const other = resolveAuthor(otherUid, viewer);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      const m = await sendMessage(user, id, body);
      setMessages((prev) => [...prev, m]);
    } catch (err) {
      setDraft(body);
      toast.error(errorMessage(err, "Message not sent. Try again."));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link href={ROUTES.inbox} aria-label="Back to messages" className="flex size-10 items-center justify-center rounded-full hover:bg-muted lg:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={ROUTES.profile(otherUid)} className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar person={other} />
          <div className="min-w-0">
            <p className="truncate font-bold">{other.displayName}</p>
            {other.neighborhoodName && <p className="truncate text-xs text-muted-foreground">{other.neighborhoodName}</p>}
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setReporting(true)}
          aria-label="Report this conversation"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Flag className="size-4" />
        </button>
      </div>

      {/* What the chat is about */}
      {convo.context && (
        <Link
          href={ROUTES.listing(convo.context.id)}
          className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 hover:bg-muted"
        >
          <span className="text-xs font-semibold text-muted-foreground">About</span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{convo.context.title}</span>
          <span className="shrink-0 text-sm font-bold text-primary">{formatNaira(convo.context.priceNaira)}</span>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Say hello to {other.displayName.split(" ")[0]}. Keep payments and meet-ups safe: meet in public and inspect before paying.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.senderUid === user.uid;
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
          return (
            <Fragment key={m._id}>
              {newDay && (
                <p className="py-2 text-center text-xs font-semibold text-muted-foreground">{dayLabel(m.createdAt)}</p>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px]",
                    mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-0.5 text-right text-[11px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {clock(m.createdAt)}
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <label htmlFor="message-input" className="sr-only">
          Message {other.displayName}
        </label>
        <textarea
          id="message-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </form>

      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ targetType: "message", targetId: id }} />
    </>
  );
}
