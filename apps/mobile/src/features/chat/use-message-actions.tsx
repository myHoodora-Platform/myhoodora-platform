import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import type { Conversation, Message, PinLength, PinnedMessage } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Copy, Flag, Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";

import { useSignedInUser } from "@/core/auth/auth-provider";
import type { BubbleFrame } from "@/shared/ui/chat";
import type { HeldMessage, MessageAction } from "@/shared/ui/message-actions";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { showDialog } from "@/shared/ui/dialog";
import { useToast } from "@/shared/ui/toast";
import { chatKeys, deleteMessage, editMessage, PIN_CHOICES, pinMessage, reactToMessage, unpinMessage } from "./chat-api";
import { canDeleteForEveryone, canEdit, EDIT_TIME_UP, editEndsAt, MAX_PINNED_MESSAGES, myReaction, withReaction } from "./message-rules";

export { bubbleReactions } from "./message-rules";

/** The thread's copy of one message, changed in place (a reaction, an edit) before the API answers. */
function patchMessage(rows: Message[] | undefined, id: string, change: (m: Message) => Message): Message[] | undefined {
  return rows?.map((m) => (m._id === id ? change(m) : m));
}


/**
 * Everything holding a message leads to (WhatsApp): react, reply, copy, pin, edit (for 15 minutes),
 * delete for everyone, report. Shared by every conversation screen, one-to-one or group.
 */
export function useMessageActions({
  conversationId,
  pins = [],
  nameOf,
  onReport,
  onEdit,
}: {
  conversationId: string;
  /** The chat's pinned messages, for Pin or Unpin in the menu. */
  pins?: PinnedMessage[];
  nameOf: (uid: string) => string;
  onReport: () => void;
  onEdit: (body: string) => void;
}) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [held, setHeld] = useState<{ message: Message; frame: BubbleFrame } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [pinning, setPinning] = useState<Message | null>(null);
  const key = chatKeys.messages(conversationId);

  // As on WhatsApp, an edit can't outlast the 15 minutes: when they run out mid-edit, it becomes a
  // new message to send (the words stay in the box). The API holds the same line, for a phone whose
  // clock is off.
  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      setEditing(null);
      toast(EDIT_TIME_UP, "error");
    }, Math.max(0, editEndsAt(editing) - Date.now()));
    return () => clearTimeout(timer);
  }, [editing, toast]);

  const react = async (m: Message, emoji: string | null) => {
    const before = client.getQueryData<Message[]>(key);
    client.setQueryData<Message[]>(key, (rows) => patchMessage(rows, m._id, (x) => withReaction(x, user.uid, emoji)));
    try {
      const fresh = await reactToMessage(user, conversationId, m._id, emoji);
      client.setQueryData<Message[]>(key, (rows) => patchMessage(rows, m._id, () => fresh));
    } catch (err) {
      client.setQueryData(key, before);
      toast(errorMessage(err), "error");
    }
  };

  const remove = (m: Message) =>
    showDialog("Delete for everyone?", "Everyone in the chat will see \"This message was deleted\".", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const fresh = await deleteMessage(user, conversationId, m._id);
            client.setQueryData<Message[]>(key, (rows) => patchMessage(rows, m._id, () => fresh));
            void client.invalidateQueries({ queryKey: chatKeys.all });
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        },
      },
    ]);

  /** Sends the edit (the composer calls this instead of sending a new message). */
  const saveEdit = async (body: string): Promise<boolean> => {
    if (!editing) return false;
    try {
      const fresh = await editMessage(user, conversationId, editing._id, body);
      client.setQueryData<Message[]>(key, (rows) => patchMessage(rows, editing._id, () => fresh));
      setEditing(null);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setEditing(null);
        toast(EDIT_TIME_UP, "error");
      } else toast(errorMessage(err), "error");
      return false;
    }
  };

  const setConversation = (fresh: Conversation) => client.setQueryData<Conversation>(chatKeys.one(conversationId), fresh);
  const pin = async (m: Message, length: PinLength, done: string) => {
    try {
      setConversation(await pinMessage(user, conversationId, m._id, length));
      toast(done);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const unpin = async (messageId: string) => {
    try {
      setConversation(await unpinMessage(user, conversationId, messageId));
      toast("Unpinned.");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  /** How long for, after a word first when it would push the oldest pin out. */
  const askPin = (m: Message) => {
    // After the hold menu has gone, so the sheet isn't closed with it.
    const choose = () => setTimeout(() => setPinning(m), 250);
    if (pins.length < MAX_PINNED_MESSAGES) return choose();
    showDialog("Replace the oldest pin?", `A chat can have ${MAX_PINNED_MESSAGES} pinned messages. This one takes the place of the oldest.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Replace", onPress: choose },
    ]);
  };
  const isPinned = (id: string) => pins.some((p) => p.messageId === id);

  const m = held?.message;
  const actions: MessageAction[] = !m
    ? []
    : [
        ...(m.deleted ? [] : [{ key: "reply", label: "Reply", Icon: Reply, onPress: () => (setEditing(null), setReplyingTo(m)) }]),
        ...(m.body && !m.deleted
          ? [
              {
                key: "copy",
                label: "Copy",
                Icon: Copy,
                onPress: () => {
                  void Clipboard.setStringAsync(m.body);
                  toast("Message copied.");
                },
              },
            ]
          : []),
        ...(m.deleted
          ? []
          : [isPinned(m._id) ? { key: "unpin", label: "Unpin", Icon: PinOff, onPress: () => void unpin(m._id) } : { key: "pin", label: "Pin", Icon: Pin, onPress: () => askPin(m) }]),
        ...(canEdit(m, user.uid) ? [{ key: "edit", label: "Edit", Icon: Pencil, onPress: () => (setReplyingTo(null), setEditing(m), onEdit(m.body)) }] : []),
        ...(canDeleteForEveryone(m, user.uid) ? [{ key: "delete", label: "Delete for everyone", Icon: Trash2, destructive: true, onPress: () => remove(m) }] : []),
        ...(m.senderUid !== user.uid ? [{ key: "report", label: "Report", Icon: Flag, destructive: true, onPress: onReport }] : []),
      ];

  const quoteOf = (q: Message | NonNullable<Message["replyTo"]>) => ({
    who: q.senderUid === user.uid ? "You" : nameOf(q.senderUid),
    body: q.body,
    photo: "photo" in q ? q.photo : !!q.photos?.length,
    deleted: !!q.deleted,
  });

  const heldView: HeldMessage | null =
    held && m
      ? {
          frame: held.frame,
          mine: m.senderUid === user.uid,
          body: m.body,
          photos: m.photos,
          quote: m.replyTo ? quoteOf(m.replyTo) : undefined,
          myReaction: myReaction(m, user.uid),
          canReact: !m.deleted,
          deleted: m.deleted,
        }
      : null;

  const banner = editing
    ? { title: "Editing message", body: editing.body, onCancel: () => setEditing(null) }
    : replyingTo
      ? { title: replyingTo.senderUid === user.uid ? "You" : nameOf(replyingTo.senderUid), body: replyingTo.body || (replyingTo.photos?.length ? "📷 Photo" : ""), onCancel: () => setReplyingTo(null) }
      : null;

  return {
    // Your own deleted message has nothing left to do (no reacting, pinning or reporting it): holding it does nothing.
    hold: (message: Message, frame: BubbleFrame) => !(message.deleted && message.senderUid === user.uid) && setHeld({ message, frame }),
    held: heldView,
    close: () => setHeld(null),
    actions,
    reactToHeld: (emoji: string | null) => m && void react(m, emoji),
    react,
    replyingTo,
    setReplyingTo,
    editing,
    saveEdit,
    banner,
    quoteOf,
    isPinned,
    unpin,
    /** "Pin for how long?": render it once in the screen. */
    pinSheet: (
      <ActionSheet
        visible={!!pinning}
        onClose={() => setPinning(null)}
        label="Pin for how long?"
        title="Pin for how long?"
        intro="A pinned message stays at the top of this chat, for everyone in it. It unpins itself when the time is up, or you can unpin it sooner."
        groups={[PIN_CHOICES.map((c) => ({ key: c.length, label: c.label, Icon: Pin, onPress: () => pinning && void pin(pinning, c.length, c.done) }))]}
      />
    ),
  };
}
