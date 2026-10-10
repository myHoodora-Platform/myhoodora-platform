"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowDown, RotateCw, SendHorizontal } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { EmojiPickerButton, insertAtCaret } from "@/components/shared/emoji-picker-button";

/** One bubble. Shared by neighbour chat and support chat. */
export interface ChatItem {
  id: string;
  mine: boolean;
  body: string;
  at: string;
  /** Local-only states for messages you just sent. */
  state?: "sending" | "failed";
  /** Small label above a bubble (e.g. "myHoodora team · Ada"). */
  label?: string;
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
                  <p className="whitespace-pre-wrap">{m.body}</p>
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
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
        onSend();
      }}
      className="flex items-end gap-2 border-t border-border p-3"
    >
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
            onSend();
          }
        }}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        disabled={disabled}
        className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
      />
      <EmojiPickerButton onSelect={(emoji) => onChange(insertAtCaret(ref.current, value, emoji))} />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Send message"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
      >
        <SendHorizontal className="size-5" aria-hidden />
      </button>
    </form>
  );
}

let localSeq = 0;
/** A temporary id for a message that hasn't reached the server yet. */
export const localId = () => `local-${Date.now()}-${++localSeq}`;
