"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, MessageCircle, Users } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import { createMemoryCache } from "@/lib/memory-cache";
import { useViewer } from "@/hooks/use-neighbourhood";
import { isGroupChat, listConversations, listRequests } from "@/lib/api/chat";
import { listSupportThreads, type SupportThreadSummary } from "@/lib/api/support";
import { SUPPORT_REPLY_TIME } from "@/features/help/support-form";
import { SupportAvatar, SupportName } from "@/features/support/support-identity";
import { resolveAuthor } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Conversation } from "@/lib/api/types";

export function otherParticipant(convo: Conversation, myUid: string): string {
  return convo.participantUids.find((u) => u !== myUid) ?? myUid;
}

// Revisiting Messages shows the last list at once, then refreshes.
const listCache = createMemoryCache<Conversation[]>(5);
export const supportListCache = createMemoryCache<SupportThreadSummary[]>(5);

/** Always first in Messages: the official support conversation(s). */
function SupportRow({ active }: { active: boolean }) {
  const { user } = useAuth();
  const version = useLiveVersion(["support.message", "unread.changed"], { mockPrefix: "support-threads" });
  const [threads, setThreads] = useState<SupportThreadSummary[] | null>(() => (user ? (supportListCache.get(user.uid) ?? null) : null));

  useEffect(() => {
    if (!user) return;
    void listSupportThreads(user)
      .then((t) => {
        supportListCache.set(user.uid, t);
        setThreads(t);
      })
      .catch(() => setThreads((prev) => prev ?? []));
  }, [user, version]);

  const latest = threads?.[0];
  const unread = Boolean(threads?.some((t) => t.unread));
  const preview =
    threads === null
      ? "\u00a0" // hold the line's height while loading, no placeholder flash
      : latest?.lastMessage
        ? `${latest.lastMessage.from === "user" ? "You: " : ""}${latest.lastMessage.body}`
        : `Questions? Real people reply, ${SUPPORT_REPLY_TIME}.`;

  return (
    <li>
      <Link
        href={ROUTES.support}
        aria-current={active ? "page" : undefined}
        className={cn("flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted", active && "bg-muted")}
      >
        <SupportAvatar />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>
              <SupportName />
            </p>
            {latest && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(latest.updatedAt)}</span>}
          </div>
          <p className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{preview}</p>
        </div>
        {unread && <span className="size-2.5 shrink-0 rounded-full bg-brand-coral" aria-label="Unread reply" />}
      </Link>
    </li>
  );
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const { user } = useAuth();
  const viewer = useViewer();
  const version = useLiveVersion(["chat.message", "chat.read"], { mockPrefix: "chat:" });
  const [items, setItems] = useState<Conversation[] | null>(() => (user ? (listCache.get(user.uid) ?? null) : null));
  // Message requests (2026-10-29): listed apart, under their own heading, until accepted.
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => {
    if (!user) return;
    void listConversations(user)
      .then((c) => {
        listCache.set(user.uid, c);
        setItems(c);
      })
      .catch(() => setItems((prev) => prev ?? []));
    void listRequests(user)
      .then(setRequests)
      .catch(() => undefined);
  }, [user, version]);

  if (items === null) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const requestsRow =
    requests.length > 0 ? (
      <li>
        <button
          type="button"
          onClick={() => setShowRequests((v) => !v)}
          aria-expanded={showRequests}
          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Message requests ({requests.length})</span>
            <span className="block truncate text-sm text-muted-foreground">From people you haven&apos;t written to. They don&apos;t know you&apos;ve read them.</span>
          </span>
        </button>
        {showRequests && <ul className="ml-4 space-y-1 border-l border-border pl-2">{requests.map((c) => row(c))}</ul>}
      </li>
    ) : null;

  function row(c: Conversation) {
    const group = isGroupChat(c);
    const other = resolveAuthor(otherParticipant(c, user!.uid), viewer);
    const unread = c.unreadCount > 0;
    const last = c.lastMessage;
    const sender = !last || last.system ? "" : last.senderUid === user?.uid ? "You: " : group ? `${resolveAuthor(last.senderUid, viewer).displayName.split(" ")[0]}: ` : "";
    return (
      <li key={c._id}>
        <Link
          href={ROUTES.conversation(c._id)}
          aria-current={activeId === c._id ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted", activeId === c._id && "bg-muted")}
        >
          {group ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-5 text-primary" aria-hidden />
            </span>
          ) : (
            <UserAvatar person={other} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={cn("truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>{group ? c.title : other.displayName}</p>
              {last && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(last.createdAt)}</span>}
            </div>
            {c.context && <p className="truncate text-xs font-semibold text-primary">{c.context.title}</p>}
            <p className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{last ? `${sender}${last.body}` : "No messages yet"}</p>
          </div>
          {unread && <span className="size-2.5 shrink-0 rounded-full bg-brand-coral" aria-label="Unread" />}
        </Link>
      </li>
    );
  }

  if (items.length === 0 && requests.length === 0) {
    return (
      <>
        <ul className="p-2">
          <SupportRow active={activeId === "support"} />
        </ul>
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <MessageCircle className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-bold">No messages yet</p>
        <p className="text-sm text-muted-foreground">
          Message a seller from For Sale &amp; Free, or a neighbour from their profile.
        </p>
        </div>
      </>
    );
  }

  return (
    <ul className="space-y-1 p-2">
      <SupportRow active={activeId === "support"} />
      {requestsRow}
      {items.map((c) => row(c))}
    </ul>
  );
}
