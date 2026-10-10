"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { getConversation, listMessages, sendMessage, sendTyping } from "@/lib/api/chat";
import { DELETED_USER_UID, resolveAuthor } from "@/lib/api/users";
import { formatNaira } from "@/lib/format";
import { useRealtime, useRealtimeResync } from "@/lib/realtime/use-realtime";
import { ROUTES } from "@/lib/routes";
import type { Conversation, Message } from "@/lib/api/types";
import { ChatComposer, ChatMessageList, localId, type ChatItem } from "./chat-ui";
import { createMemoryCache } from "@/lib/memory-cache";
import { otherParticipant } from "./conversation-list";
import { MESSAGE_PAGE, mergeMessages } from "./message-pages";
import { useTypingIndicator, useTypingSignal } from "./use-typing";

// Reopening a thread shows its last messages at once, then refreshes.
const threadCache = createMemoryCache<{ convo: Conversation; messages: Message[] }>(30);

/** A message you've sent that the server hasn't confirmed (or rejected). */
interface Pending {
  id: string;
  body: string;
  at: string;
  state: "sending" | "failed";
}

export function ConversationThread({ id }: { id: string }) {
  const { user } = useAuth();
  const viewer = useViewer();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cacheKey = `${user?.uid}:${id}`;
  const [convo, setConvo] = useState<Conversation | null | undefined>(() => threadCache.get(cacheKey)?.convo);
  const [messages, setMessages] = useState<Message[]>(() => threadCache.get(cacheKey)?.messages ?? []);
  const [pending, setPending] = useState<Pending[]>([]);
  // A full page came back, so the conversation may go back further than what is on screen.
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState(() => params.get("draft") ?? "");
  const [reporting, setReporting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [c, m] = await Promise.all([getConversation(user, id), listMessages(user, id)]);
      setConvo(c);
      // The newest page, added to what is on screen: a refetch must not drop earlier pages already loaded.
      setMessages((prev) => (prev.some((x) => x.conversationId !== id) ? m : mergeMessages(prev, m)));
      if (m.length >= MESSAGE_PAGE) setHasEarlier(true);
      if (c) threadCache.set(`${user.uid}:${id}`, { convo: c, messages: m });
    } catch {
      setConvo((prev) => (prev === undefined ? null : prev));
    }
  }, [user, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!user || !oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const earlier = await listMessages(user, id, { before: oldest._id });
      setMessages((prev) => mergeMessages(prev, earlier));
      setHasEarlier(earlier.length >= MESSAGE_PAGE);
    } catch {
      // Leave the button in place: pressing it again retries.
    } finally {
      setLoadingEarlier(false);
    }
  };

  // Live: a new message or read receipt in this thread → refetch (the API
  // is the source of truth; the event only says "something changed").
  useRealtime(["chat.message", "chat.read"], (e) => {
    if (e.conversationId === id) void load();
  });
  useRealtimeResync(() => void load());

  const otherTyping = useTypingIndicator("chat.typing", ["chat.message"], (e) => e.conversationId === id);
  useTypingSignal(draft, () => (user ? sendTyping(user, id) : Promise.resolve()));

  useEffect(() => {
    if (params.has("draft")) router.replace(pathname, { scroll: false });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (convo) inputRef.current?.focus();
  }, [convo]);

  const deliver = async (p: Pending) => {
    if (!user) return;
    try {
      const m = await sendMessage(user, id, p.body);
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
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
  // They deleted their account. The conversation is still ours to read; there is nobody to write to or to visit.
  const otherDeleted = otherUid === DELETED_USER_UID;

  const items: ChatItem[] = [
    ...messages.map((m) => ({ id: m._id, mine: m.senderUid === user.uid, body: m.body, at: m.createdAt })),
    ...pending.map((p) => ({ id: p.id, mine: true, body: p.body, at: p.at, state: p.state })),
  ];
  const seenAt = convo.readBy?.find((r) => r.uid === otherUid)?.lastReadAt;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link href={ROUTES.inbox} aria-label="Back to messages" className="flex size-10 items-center justify-center rounded-full hover:bg-muted lg:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        {otherDeleted ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar person={other} />
            <p className="truncate font-bold text-muted-foreground">{other.displayName}</p>
          </div>
        ) : (
          <Link href={ROUTES.profile(otherUid)} className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar person={other} />
            <div className="min-w-0">
              <p className="truncate font-bold">{other.displayName}</p>
              {other.neighborhoodName && <p className="truncate text-xs text-muted-foreground">{other.neighborhoodName}</p>}
            </div>
          </Link>
        )}
        {!otherDeleted && (
          <button
            type="button"
            onClick={() => setReporting(true)}
            aria-label="Report this conversation"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Flag className="size-4" />
          </button>
        )}
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

      <ChatMessageList
        items={items}
        header={
          hasEarlier && (
            <div className="pb-2 text-center">
              <button
                type="button"
                onClick={() => void loadEarlier()}
                disabled={loadingEarlier}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
              >
                {loadingEarlier ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )
        }
        seenAt={seenAt}
        onRetry={retry}
        typing={otherTyping ? other.displayName.split(" ")[0] : null}
        empty={
          <p className="py-8 text-center text-sm text-muted-foreground">
            Say hello to {other.displayName.split(" ")[0]}. Keep payments and meet-ups safe: meet in public and inspect before paying.
          </p>
        }
      />

      {otherDeleted ? (
        <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
          This person has deleted their account. You can still read your conversation, but you can&apos;t send new messages.
        </p>
      ) : (
        <ChatComposer value={draft} onChange={setDraft} onSend={send} label={`Message ${other.displayName}`} inputRef={inputRef} />
      )}

      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ targetType: "message", targetId: id }} />
    </>
  );
}
