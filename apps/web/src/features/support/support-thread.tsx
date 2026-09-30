"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { ChatComposer, ChatMessageList, localId, type ChatItem } from "@/features/chat/chat-ui";
import { SUPPORT_REPLY_TIME } from "@/features/help/support-form";
import { errorKind } from "@/lib/api/client";
import { getSupportThread, replyToSupport, sendSupportTyping, type SupportThread } from "@/lib/api/support";
import { useTypingIndicator, useTypingSignal } from "@/features/chat/use-typing";
import { useRealtime, useRealtimeResync } from "@/lib/realtime/use-realtime";
import { ROUTES } from "@/lib/routes";
import { SupportAvatar, SupportName, SupportStatusChip } from "./support-identity";
import { createMemoryCache } from "@/lib/memory-cache";

// Reopening a conversation shows it at once, then refreshes.
const supportThreadCache = createMemoryCache<SupportThread>(20);

interface Pending {
  id: string;
  body: string;
  at: string;
  state: "sending" | "failed";
}

/** One conversation with the team, live: replies appear the moment they're sent. */
export function SupportThreadView({ id }: { id: string }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<SupportThread | null | undefined>(() => supportThreadCache.get(`${user?.uid}:${id}`));
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const t = await getSupportThread(user, id);
      supportThreadCache.set(`${user.uid}:${id}`, t);
      setThread(t);
    } catch (err) {
      if (errorKind(err) === "not_found") setThread(null);
      else setThread((prev) => prev ?? null);
    }
  }, [user, id]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime("support.message", (e) => {
    if (e.threadId === id) void load();
  });
  useRealtimeResync(() => void load());

  const teamTyping = useTypingIndicator("support.typing", ["support.message"], (e) => e.threadId === id);
  useTypingSignal(draft, () => (user ? sendSupportTyping(user, id) : Promise.resolve()));

  const deliver = async (p: Pending) => {
    if (!user) return;
    try {
      const next = await replyToSupport(user, id, p.body);
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      supportThreadCache.set(`${user.uid}:${id}`, next);
      setThread(next);
    } catch {
      setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, state: "failed" } : x)));
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const p: Pending = { id: localId(), body, at: new Date().toISOString(), state: "sending" };
    setDraft("");
    setPending((prev) => [...prev, p]);
    void deliver(p);
    inputRef.current?.focus();
  };

  const retry = (localMessageId: string) => {
    const p = pending.find((x) => x.id === localMessageId);
    if (!p) return;
    const again = { ...p, state: "sending" as const };
    setPending((prev) => prev.map((x) => (x.id === p.id ? again : x)));
    void deliver(again);
  };

  if (thread === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-56 rounded-2xl" />
      </div>
    );
  }
  if (thread === null) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <p>This conversation isn&apos;t available.</p>
        <Link href={ROUTES.support} className="mt-2 inline-block font-semibold text-primary hover:underline">
          See your conversations
        </Link>
      </div>
    );
  }

  const items: ChatItem[] = [
    ...thread.messages.map((m, i) => ({
      id: `${i}-${m.at}`,
      mine: m.from === "user",
      body: m.body,
      at: m.at,
      label: m.from === "staff" ? `myHoodora team${m.by ? ` · ${m.by}` : ""}` : undefined,
    })),
    ...pending.map((p) => ({ id: p.id, mine: true, body: p.body, at: p.at, state: p.state })),
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link href={ROUTES.support} aria-label="Back to support conversations" className="flex size-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <SupportAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            <SupportName />
          </p>
          <p className="truncate text-xs text-muted-foreground">{thread.subject}</p>
        </div>
        <SupportStatusChip status={thread.status} />
      </div>

      {thread.status === "resolved" ? (
        <p className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden /> This conversation is resolved. Reply to reopen it.
        </p>
      ) : (
        thread.status === "open" && (
          <p className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden /> We&apos;ll reply here, {SUPPORT_REPLY_TIME}. You&apos;ll get a notification too.
          </p>
        )
      )}

      <ChatMessageList items={items} onRetry={retry} typing={teamTyping ? "myHoodora team" : null} />

      <ChatComposer value={draft} onChange={setDraft} onSend={send} label="Message myHoodora Support" placeholder="Write to the team…" inputRef={inputRef} />
    </>
  );
}
