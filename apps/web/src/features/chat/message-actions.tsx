"use client";

import { useEffect, useState } from "react";
import { Copy, Forward, MoreHorizontal, Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@myhoodora/ui/dropdown-menu";
import { cn } from "@myhoodora/ui/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { listConversations, PIN_LENGTHS } from "@/lib/api/chat";
import { resolveAuthor } from "@/lib/api/users";
import { MAX_FORWARD_TO, MESSAGE_DELETE_WINDOW_MS, MESSAGE_EDIT_WINDOW_MS, type Conversation, type Message, type PinLength } from "@/lib/api/types";
import { otherParticipant } from "./conversation-list";

/** WhatsApp's quick reactions. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export interface MessageMenuActions {
  react: (emoji: string) => void;
  reply: () => void;
  edit: () => void;
  pin: (length: PinLength) => void;
  unpin: () => void;
  forward: () => void;
  deleteForMe: () => void;
  deleteForEveryone: () => void;
}

/** What you may do with a message now (the API checks the same rules). */
export function messageAllows(m: Message, me: string, pinned: boolean, now = Date.now()) {
  const mine = m.senderUid === me;
  const age = now - new Date(m.createdAt).getTime();
  return {
    react: !m.deleted,
    reply: !m.deleted,
    copy: !m.deleted && !!m.body,
    edit: mine && !m.deleted && !m.forwarded && !!m.body && age <= MESSAGE_EDIT_WINDOW_MS,
    pin: !m.deleted && !pinned,
    unpin: pinned,
    forward: !m.deleted,
    deleteForEveryone: mine && !m.deleted && age <= MESSAGE_DELETE_WINDOW_MS,
  };
}

/** The ⋯ beside a bubble: a reaction row, then what you can do with it. */
export function MessageMenu({ message, me, pinned, myReaction, actions }: { message: Message; me: string; pinned: boolean; myReaction?: string; actions: MessageMenuActions }) {
  const can = messageAllows(message, me, pinned);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Message options" className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:opacity-100">
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={message.senderUid === me ? "end" : "start"} className="min-w-56">
        {can.react && (
          <>
            <div className="flex justify-between gap-1 px-1 pb-1" role="group" aria-label="React">
              {QUICK_REACTIONS.map((e) => (
                <DropdownMenuItem key={e} onSelect={() => actions.react(e)} aria-label={myReaction === e ? `Remove ${e}` : `React ${e}`} className={cn("justify-center px-1.5 text-xl", myReaction === e && "bg-primary/10")}>
                  {e}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {can.reply && (
          <DropdownMenuItem onSelect={actions.reply}>
            <Reply className="size-4" aria-hidden /> Reply
          </DropdownMenuItem>
        )}
        {can.copy && (
          <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(message.body)}>
            <Copy className="size-4" aria-hidden /> Copy
          </DropdownMenuItem>
        )}
        {can.edit && (
          <DropdownMenuItem onSelect={actions.edit}>
            <Pencil className="size-4" aria-hidden /> Edit
          </DropdownMenuItem>
        )}
        {can.forward && (
          <DropdownMenuItem onSelect={actions.forward}>
            <Forward className="size-4" aria-hidden /> Forward
          </DropdownMenuItem>
        )}
        {can.unpin && (
          <DropdownMenuItem onSelect={actions.unpin}>
            <PinOff className="size-4" aria-hidden /> Unpin
          </DropdownMenuItem>
        )}
        {can.pin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              <Pin className="size-3.5" aria-hidden /> Pin for everyone, for
            </DropdownMenuLabel>
            {PIN_LENGTHS.map((p) => (
              <DropdownMenuItem key={p.length} onSelect={() => actions.pin(p.length)} className="pl-8">
                {p.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={actions.deleteForMe} className="text-destructive focus:text-destructive">
          <Trash2 className="size-4" aria-hidden /> Delete for me
        </DropdownMenuItem>
        {can.deleteForEveryone && (
          <DropdownMenuItem onSelect={actions.deleteForEveryone} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" aria-hidden /> Delete for everyone
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Forward to up to 5 of your chats (one, for a message already forwarded many times), as on
 * WhatsApp. Each chat succeeds or fails on its own.
 */
export function ForwardDialog({
  open,
  onOpenChange,
  from,
  manyTimes,
  onForward,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: string;
  manyTimes: boolean;
  onForward: (conversationIds: string[]) => Promise<void>;
}) {
  const { user } = useAuth();
  const viewer = useViewer();
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const max = manyTimes ? 1 : MAX_FORWARD_TO;

  useEffect(() => {
    if (!open || !user) return;
    setPicked([]);
    void listConversations(user)
      .then((c) => setChats(c.filter((x) => x._id !== from)))
      .catch(() => setChats([]));
  }, [open, user, from]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? (max === 1 ? [id] : p) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward to…</DialogTitle>
          <DialogDescription>{manyTimes ? "This message has been forwarded many times, so it can go to one chat at a time." : `Choose up to ${MAX_FORWARD_TO} chats.`}</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {chats === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading your chats…</p>
          ) : chats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No other chats to forward to yet.</p>
          ) : (
            chats.map((c) => {
              const person = resolveAuthor(otherParticipant(c, user?.uid ?? ""), viewer);
              const on = picked.includes(c._id);
              return (
                <label key={c._id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted", on && "bg-primary/5")}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c._id)} className="size-4 accent-[var(--color-primary)]" />
                  <UserAvatar person={person} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{person.displayName}</span>
                    {c.context && <span className="block truncate text-xs text-muted-foreground">About {c.context.title}</span>}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!picked.length || sending}
            onClick={async () => {
              setSending(true);
              try {
                await onForward(picked);
                onOpenChange(false);
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? "Forwarding…" : picked.length > 1 ? `Forward to ${picked.length} chats` : "Forward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
