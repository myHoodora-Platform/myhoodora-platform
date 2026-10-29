"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flag, Pin, Users, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { errorMessage } from "@/lib/api/client";
import {
  acceptRequest,
  deleteConversationForMe,
  isGroupChat,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  forwardMessage,
  getConversation,
  listMessages,
  pinMessage,
  reactToMessage,
  sendMessage,
  sendTyping,
  unpinMessage,
} from "@/lib/api/chat";
import { DELETED_USER_UID, resolveAuthor } from "@/lib/api/users";
import { formatNaira } from "@/lib/format";
import { useRealtime, useRealtimeResync } from "@/lib/realtime/use-realtime";
import { ROUTES } from "@/lib/routes";
import type { Conversation, Message } from "@/lib/api/types";
import { ChatComposer, ChatMessageList, localId, type ChatItem } from "./chat-ui";
import { ForwardDialog, MessageMenu } from "./message-actions";
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
  replyTo?: string;
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
  // WhatsApp's message actions (2026-10-29): what the box is doing, and the open dialogs.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ message: Message; before: string } | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
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
      const m = await sendMessage(user, id, p.body, p.replyTo);
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
    } catch {
      setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, state: "failed" } : x)));
    }
  };

  /** A message the API sent back changed: put it in place. */
  const replace = (m: Message) => setMessages((prev) => prev.map((x) => (x._id === m._id ? m : x)));
  const failed = (err: unknown, fallback: string) => toast.error(errorMessage(err, fallback));

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    if (editing && user) {
      // Done editing: back to whatever was being written before.
      const { message, before } = editing;
      setEditing(null);
      setDraft(before);
      if (body !== message.body) void editMessage(user, id, message._id, body).then(replace, (err) => failed(err, "Couldn't edit the message."));
      return;
    }
    const p: Pending = { id: localId(), body, at: new Date().toISOString(), state: "sending", replyTo: replyTo?._id };
    setReplyTo(null);
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

  const group = isGroupChat(convo);
  const otherUid = otherParticipant(convo, user.uid);
  const other = resolveAuthor(otherUid, viewer);
  // They deleted their account. The conversation is still ours to read; there is nobody to write to or to visit.
  const otherDeleted = otherUid === DELETED_USER_UID;

  const nameOf = (uid: string) => (uid === user.uid ? "You" : resolveAuthor(uid, viewer).displayName);
  const byId = new Map(messages.map((m) => [m._id, m]));
  const pinnedIds = new Set((convo.pins ?? []).map((p) => p.messageId));
  const items: ChatItem[] = [
    ...messages.map((m, i) => ({
      // In a group, who wrote it, above the first of theirs in a run; a notice says itself.
      label: group && !m.system && m.senderUid !== user.uid && (i === 0 || messages[i - 1]!.senderUid !== m.senderUid || !!messages[i - 1]!.system) ? nameOf(m.senderUid) : undefined,
      notice: !!m.system,
      id: m._id,
      mine: m.senderUid === user.uid,
      body: m.body,
      photos: m.photos,
      at: m.createdAt,
      edited: !!m.editedAt,
      deleted: m.deleted,
      forwarded: m.forwardedManyTimes ? ("many" as const) : m.forwarded ? ("once" as const) : undefined,
      replyTo: m.replyTo ? { name: nameOf(m.replyTo.senderUid), body: m.replyTo.body, photo: m.replyTo.photo, deleted: m.replyTo.deleted } : undefined,
      reactions: m.reactions?.map((r) => ({ emoji: r.emoji, count: r.uids.length, mine: r.uids.includes(user.uid) })),
    })),
    ...pending.map((p) => ({ id: p.id, mine: true, body: p.body, at: p.at, state: p.state })),
  ];
  // In a group, "Seen" once everyone else has read it.
  const othersRead = (convo.readBy ?? []).filter((r) => r.uid !== user.uid);
  const seenAt = group ? (othersRead.some((r) => !r.lastReadAt) ? undefined : othersRead.map((r) => r.lastReadAt!).sort()[0]) : convo.readBy?.find((r) => r.uid === otherUid)?.lastReadAt;

  const react = (m: Message, emoji: string) => {
    const mine = m.reactions?.find((r) => r.uids.includes(user.uid))?.emoji;
    void reactToMessage(user, id, m._id, mine === emoji ? null : emoji).then(replace, (err) => failed(err, "Couldn't react."));
  };
  const menu = (item: ChatItem) => {
    const m = byId.get(item.id);
    if (!m || m.system || (!group && otherDeleted)) return null;
    return (
      <MessageMenu
        message={m}
        me={user.uid}
        pinned={pinnedIds.has(m._id)}
        myReaction={m.reactions?.find((r) => r.uids.includes(user.uid))?.emoji}
        actions={{
          react: (emoji) => react(m, emoji),
          reply: () => {
            setEditing(null);
            setReplyTo(m);
            inputRef.current?.focus();
          },
          edit: () => {
            setReplyTo(null);
            setEditing({ message: m, before: draft });
            setDraft(m.body);
            inputRef.current?.focus();
          },
          pin: (length) => void pinMessage(user, id, m._id, length).then(setConvo, (err) => failed(err, "Couldn't pin the message.")),
          unpin: () => void unpinMessage(user, id, m._id).then(setConvo, (err) => failed(err, "Couldn't unpin the message.")),
          forward: () => setForwarding(m),
          deleteForMe: () =>
            void deleteMessageForMe(user, id, m._id).then(
              () => setMessages((prev) => prev.filter((x) => x._id !== m._id)),
              (err) => failed(err, "Couldn't delete the message."),
            ),
          deleteForEveryone: () => setDeleting(m),
        }}
      />
    );
  };
  const banner = editing
    ? { title: "Editing", body: editing.message.body, onCancel: () => (setDraft(editing.before), setEditing(null)) }
    : replyTo
      ? { title: `Replying to ${nameOf(replyTo.senderUid) === "You" ? "yourself" : nameOf(replyTo.senderUid)}`, body: replyTo.deleted ? "This message was deleted" : replyTo.body || "Photo", onCancel: () => setReplyTo(null) }
      : null;
  const pins = convo.pins ?? [];

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link href={ROUTES.inbox} aria-label="Back to messages" className="flex size-10 items-center justify-center rounded-full hover:bg-muted lg:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        {group ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-5 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold">{convo.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {(convo.participants ?? []).map((p) => (p.uid === user.uid ? "You" : p.displayName.split(" ")[0])).join(", ")}
              </p>
            </div>
          </div>
        ) : otherDeleted ? (
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
        {(group || !otherDeleted) && (
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

      {/* Pinned for everyone in the chat (up to 3), newest first: click to go to it. */}
      {pins.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Pin className="size-4 shrink-0 text-primary" aria-hidden />
          <button
            type="button"
            onClick={() => document.getElementById(`message-${pins[0]!.messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block text-xs font-semibold text-primary">{pins.length > 1 ? `${pins.length} pinned messages` : "Pinned message"}</span>
            <span className="block truncate text-sm">
              <span className="font-semibold">{nameOf(pins[0]!.senderUid)}:</span> {pins[0]!.body || (pins[0]!.photo ? "Photo" : "")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void unpinMessage(user, id, pins[0]!.messageId).then(setConvo, (err) => failed(err, "Couldn't unpin the message."))}
            aria-label="Unpin"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <ChatMessageList
        items={items}
        menu={menu}
        onReaction={(item, emoji) => {
          const m = byId.get(item.id);
          if (m) react(m, emoji);
        }}
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

      {convo.request && (
        <div className="space-y-2 border-t border-border bg-muted/50 p-4">
          <p className="font-semibold">{other.displayName} wants to message you</p>
          <p className="text-sm text-muted-foreground">You haven&apos;t written to each other before. They won&apos;t know you&apos;ve read this until you accept or reply.</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void deleteConversationForMe(user, id).then(
                  () => router.push(ROUTES.inbox),
                  (err) => failed(err, "Couldn't delete the request."),
                )
              }
            >
              Delete
            </Button>
            <Button onClick={() => void acceptRequest(user, id).then(setConvo, (err) => failed(err, "Couldn't accept the request."))}>Accept</Button>
          </div>
        </div>
      )}

      {!group && otherDeleted ? (
        <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
          This person has deleted their account. You can still read your conversation, but you can&apos;t send new messages.
        </p>
      ) : (
        <ChatComposer value={draft} onChange={setDraft} onSend={send} label={editing ? "Edit your message" : `Message ${group ? convo.title : other.displayName}`} inputRef={inputRef} banner={banner} />
      )}

      <ForwardDialog
        open={!!forwarding}
        onOpenChange={(open) => !open && setForwarding(null)}
        from={id}
        manyTimes={!!forwarding?.forwardedManyTimes}
        onForward={async (ids) => {
          if (!forwarding) return;
          try {
            const r = await forwardMessage(user, id, forwarding._id, ids);
            if (r.failed.length) toast.error(`Forwarded to ${r.sent.length}; ${r.failed.length} couldn't receive it: ${r.failed[0]!.message}`);
            else toast.success(r.sent.length > 1 ? `Forwarded to ${r.sent.length} chats.` : "Forwarded.");
          } catch (err) {
            failed(err, "Couldn't forward the message.");
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete for everyone?"
        description="It's replaced by “This message was deleted” for everyone in this chat. Messages can be deleted for everyone for about 2 days after they're sent."
        confirmLabel="Delete for everyone"
        destructive
        onConfirm={() => {
          const m = deleting;
          setDeleting(null);
          if (m) void deleteMessageForEveryone(user, id, m._id).then(replace, (err) => failed(err, "Couldn't delete the message."));
        }}
      />
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ targetType: "message", targetId: id }} />
    </>
  );
}
