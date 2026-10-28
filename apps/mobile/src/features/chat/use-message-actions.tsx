import { errorMessage } from "@myhoodora/api-contract/errors";
import { MESSAGE_DELETE_WINDOW_MS, MESSAGE_EDIT_WINDOW_MS, type Message } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Copy, Flag, Pencil, Reply, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import type { BubbleFrame, BubbleReaction } from "@/shared/ui/chat";
import type { HeldMessage, MessageAction } from "@/shared/ui/message-actions";
import { useToast } from "@/shared/ui/toast";
import { chatKeys, deleteMessage, editMessage, reactToMessage } from "./chat-api";

/** The thread's copy of one message, changed in place (a reaction, an edit) before the API answers. */
function patchMessage(rows: Message[] | undefined, id: string, change: (m: Message) => Message): Message[] | undefined {
  return rows?.map((m) => (m._id === id ? change(m) : m));
}

/** Your reaction set to `emoji` (or taken back): one per person, grouped by emoji, most first. */
export function withReaction(m: Message, uid: string, emoji: string | null): Message {
  const groups = (m.reactions ?? []).map((r) => ({ ...r, uids: r.uids.filter((u) => u !== uid) })).filter((r) => r.uids.length);
  if (emoji) {
    const g = groups.find((r) => r.emoji === emoji);
    if (g) g.uids.push(uid);
    else groups.push({ emoji, uids: [uid] });
  }
  groups.sort((a, b) => b.uids.length - a.uids.length);
  return { ...m, reactions: groups.length ? groups : undefined };
}

export const myReaction = (m: Message, uid: string) => m.reactions?.find((r) => r.uids.includes(uid))?.emoji ?? null;

/** For the pills under a bubble. */
export const bubbleReactions = (m: Message, uid: string): BubbleReaction[] => (m.reactions ?? []).map((r) => ({ emoji: r.emoji, count: r.uids.length, mine: r.uids.includes(uid) }));

export const canEdit = (m: Message, uid: string, now = Date.now()) => m.senderUid === uid && !m.deleted && !!m.body && now - new Date(m.createdAt).getTime() < MESSAGE_EDIT_WINDOW_MS;
export const canDeleteForEveryone = (m: Message, uid: string, now = Date.now()) => m.senderUid === uid && !m.deleted && now - new Date(m.createdAt).getTime() < MESSAGE_DELETE_WINDOW_MS;

/**
 * Everything holding a message leads to (WhatsApp): react, reply, copy, edit, delete for everyone,
 * report. Shared by every conversation screen, one-to-one or group.
 */
export function useMessageActions({ conversationId, nameOf, onReport, onEdit }: { conversationId: string; nameOf: (uid: string) => string; onReport: () => void; onEdit: (body: string) => void }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [held, setHeld] = useState<{ message: Message; frame: BubbleFrame } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const key = chatKeys.messages(conversationId);

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
    Alert.alert("Delete for everyone?", "Everyone in the chat will see \"This message was deleted\".", [
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
      toast(errorMessage(err), "error");
      return false;
    }
  };

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
        }
      : null;

  const banner = editing
    ? { title: "Editing message", body: editing.body, onCancel: () => setEditing(null) }
    : replyingTo
      ? { title: replyingTo.senderUid === user.uid ? "You" : nameOf(replyingTo.senderUid), body: replyingTo.body || (replyingTo.photos?.length ? "📷 Photo" : ""), onCancel: () => setReplyingTo(null) }
      : null;

  return {
    hold: (message: Message, frame: BubbleFrame) => setHeld({ message, frame }),
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
  };
}
