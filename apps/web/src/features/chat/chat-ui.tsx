"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowDown, FileText, Loader2, Paperclip, RotateCw, SendHorizontal, X } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { EmojiPickerButton, insertAtCaret } from "@/components/shared/emoji-picker-button";
import type { Attachments } from "./use-attachments";

/** One bubble. Shared by neighbour chat and support chat. */
export interface ChatItem {
  id: string;
  mine: boolean;
  body: string;
  /** Photos sent with it (from the app, since 2026-10-28). */
  photos?: string[];
  /** PDFs sent with it (support conversations, 2026-10-28). */
  documents?: { url: string; name?: string; bytes?: number }[];
  at: string;
  /** Local-only states for messages you just sent. */
  state?: "sending" | "failed";
  /** Small label above a bubble (e.g. "myHoodora team · Ada"). */
  label?: string;
}

/** "2.4 MB", "820 KB". */
export function fileSize(bytes?: number): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function dayLabel(iso: string): string {
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

/** Within this many px of the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80;

/**
 * Message list that behaves like a chat app: new messages stick to the
 * bottom only if you're already there (or sent them); otherwise a
 * "New messages" pill appears instead of yanking you away from what you're reading.
 */
/** "Ada is typing" as a bubble of three pulsing dots (the familiar chat-app cue). */
export function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex justify-start" role="status" aria-label={`${label} is typing`}>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 150, 300].map((delay) => (
            <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </span>
        <span className="text-xs text-muted-foreground">{label} is typing</span>
      </div>
    </div>
  );
}

export function ChatMessageList({
  items,
  empty,
  header,
  seenAt,
  onRetry,
  typing,
  mineClassName = "bg-primary text-primary-foreground",
}: {
  items: ChatItem[];
  empty?: ReactNode;
  /** Shown above the first message, inside the scrolling area (e.g. "Load earlier messages"). */
  header?: ReactNode;
  /** Who's typing on the other side (shows animated dots), or nothing. */
  typing?: string | null;
  /** When the other side last read the thread: shows "Seen" under your last message. */
  seenAt?: string;
  onRetry?: (id: string) => void;
  mineClassName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastCount = useRef(0);
  const lastNewest = useRef<string | undefined>(undefined);
  const [unseenBelow, setUnseenBelow] = useState(false);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseenBelow(false);
  };

  useLayoutEffect(() => {
    const grew = items.length > lastCount.current;
    const first = lastCount.current === 0;
    lastCount.current = items.length;
    const newest = items[items.length - 1];
    // Earlier messages loaded above grow the list too, but nothing new arrived: stay where the reader is.
    const arrivedBelow = newest?.id !== lastNewest.current;
    lastNewest.current = newest?.id;
    if (!grew || !arrivedBelow) return;
    if (first || nearBottom.current || newest?.mine) scrollToBottom(!first);
    else setUnseenBelow(true);
  }, [items]);

  // Keep the dots in view when they appear, if the reader is at the bottom.
  useEffect(() => {
    if (typing && nearBottom.current) scrollToBottom(true);
  }, [typing]);

  const lastMine = [...items].reverse().find((m) => m.mine && !m.state);
  const seen = Boolean(seenAt && lastMine && new Date(seenAt) >= new Date(lastMine.at));

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
          if (nearBottom.current) setUnseenBelow(false);
        }}
        className="h-full space-y-1 overflow-y-auto p-4"
        aria-live="polite"
      >
        {items.length === 0 && empty}
        {header}
        {items.map((m, i) => {
          const prev = items[i - 1];
          const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
          return (
            <Fragment key={m.id}>
              {newDay && <p className="py-2 text-center text-xs font-semibold text-muted-foreground">{dayLabel(m.at)}</p>}
              {m.label && (!prev || prev.label !== m.label || newDay) && (
                <p className={cn("px-1 pt-1 text-xs font-semibold text-muted-foreground", m.mine && "text-right")}>{m.label}</p>
              )}
              <div className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px]",
                    m.mine ? cn("rounded-br-md", mineClassName) : "rounded-bl-md bg-muted text-foreground",
                    m.state === "sending" && "opacity-70",
                    m.state === "failed" && "bg-danger-soft text-foreground",
                  )}
                >
                  {m.photos?.length ? (
                    <div className={cn("-mx-1.5 mb-1 grid gap-1", m.photos.length > 1 && "grid-cols-2")}>
                      {m.photos.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a photo a neighbour sent */}
                          <img src={url} alt="Photo in the message" className="aspect-square w-full max-w-60 object-cover" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {m.documents?.length ? <DocumentLinks documents={m.documents} mine={m.mine} /> : null}
                  {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                  <p className={cn("mt-0.5 text-right text-[11px]", m.mine && !m.state ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {m.state === "sending" ? "Sending…" : m.state === "failed" ? "Not sent" : clock(m.at)}
                  </p>
                </div>
              </div>
              {m.state === "failed" && onRetry && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => onRetry(m.id)} className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-destructive hover:underline">
                    <RotateCw className="size-3" aria-hidden /> Retry
                  </button>
                </div>
              )}
              {seen && m === lastMine && <p className="px-1 text-right text-[11px] font-semibold text-muted-foreground">Seen</p>}
            </Fragment>
          );
        })}
        {typing && <TypingDots label={typing} />}
      </div>
      {unseenBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg"
        >
          New messages <ArrowDown className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Auto-growing message box: Enter sends, Shift+Enter adds a line. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  label,
  placeholder = "Write a message…",
  disabled,
  inputRef,
  attachments,
  accept,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Files to send with it (useAttachments); shows an attach button and the tray. */
  attachments?: Attachments;
  /** File types the attach button offers. */
  accept?: string;
}) {
  const ready = !!attachments && attachments.ready.length > 0 && !attachments.failed;
  const canSend = (value.trim().length > 0 || ready) && !attachments?.uploading && !disabled;
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value, ref]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="border-t border-border p-3"
    >
      {attachments ? <AttachmentTray attachments={attachments} /> : null}
      <div className="flex items-end gap-2">
      {attachments ? <AttachButton attachments={attachments} accept={accept} /> : null}
      <label htmlFor="message-input" className="sr-only">
        {label}
      </label>
      <textarea
        id="message-input"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        rows={1}
        maxLength={2000}
        placeholder={attachments?.items.length ? "Add a message (optional)" : placeholder}
        disabled={disabled}
        className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
      />
      <EmojiPickerButton onSelect={(emoji) => onChange(insertAtCaret(ref.current, value, emoji))} />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
      >
        <SendHorizontal className="size-5" aria-hidden />
      </button>
      </div>
    </form>
  );
}


/** PDFs in a message: a card each, opening in a new tab. */
export function DocumentLinks({ documents, mine = false }: { documents: { url: string; name?: string; bytes?: number }[]; mine?: boolean }) {
  return (
    <>
      {documents.map((d) => (
        <a
          key={d.url}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className={cn("-mx-1 mb-1 flex min-w-56 items-center gap-2.5 rounded-xl p-2", mine ? "bg-white/15 hover:bg-white/25" : "bg-card hover:bg-card/80")}
        >
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/20" : "bg-danger-soft text-destructive")}>
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{d.name ?? "Document"}</span>
            <span className="block text-xs opacity-75">PDF{d.bytes ? ` · ${fileSize(d.bytes)}` : ""}</span>
          </span>
        </a>
      ))}
    </>
  );
}

/** Files about to be sent (useAttachments): each with its state; retry a failed one, remove any. */
export function AttachmentTray({ attachments }: { attachments: Attachments }) {
  const failed = attachments.items.find((a) => a.status === "failed");
  return (
    <>
      {attachments.items.length ? (
        <ul className="mb-2 flex gap-2 overflow-x-auto" aria-label="Files to send">
          {attachments.items.map((a) => (
            <li key={a.key} className="relative flex h-16 shrink-0 items-center overflow-hidden rounded-xl bg-muted">
              {a.kind === "image" && a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                <img src={a.preview} alt={a.name} className="size-16 object-cover" />
              ) : (
                <span className="flex w-40 items-center gap-2 px-3 pr-7 text-xs font-semibold">
                  <FileText className="size-4 shrink-0 text-destructive" aria-hidden />
                  <span className="line-clamp-2">{a.name}</span>
                </span>
              )}
              {a.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35" aria-label={`${a.name}, uploading`}>
                  <Loader2 className="size-4 animate-spin text-white" aria-hidden />
                </span>
              )}
              {a.status === "failed" && (
                <button type="button" onClick={() => attachments.retry(a.key)} title={a.error} className="absolute inset-0 flex items-center justify-center bg-red-700/60 text-white" aria-label={`${a.name} didn't upload. Retry`}>
                  <RotateCw className="size-4" aria-hidden />
                </button>
              )}
              <button type="button" onClick={() => attachments.remove(a.key)} className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white" aria-label={`Remove ${a.name}`}>
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed && <p className="mb-2 text-xs font-semibold text-destructive">{failed.name} didn&apos;t upload: {failed.error ?? "try again"}. Click it to try again.</p>}
    </>
  );
}

/** A paperclip that opens the file chooser, while there's room for more. */
export function AttachButton({ attachments, accept }: { attachments: Attachments; accept?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      {attachments.room > 0 ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (picked.length) attachments.add(picked);
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo or file" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <Paperclip className="size-5" aria-hidden />
          </button>
        </>
      ) : null}
    </>
  );
}

let localSeq = 0;
/** A temporary id for a message that hasn't reached the server yet. */
export const localId = () => `local-${Date.now()}-${++localSeq}`;
