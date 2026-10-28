import { MESSAGE_DELETE_WINDOW_MS, MESSAGE_EDIT_WINDOW_MS, type Message } from "@myhoodora/api-contract/types";
import type { BubbleReaction } from "@/shared/ui/chat";

/** What you may do with a message, and when (WhatsApp's rules). No React here, so tests run it as is. */

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
/** When the 15 minutes to edit it run out. */
export const editEndsAt = (m: Message) => new Date(m.createdAt).getTime() + MESSAGE_EDIT_WINDOW_MS;
export const EDIT_TIME_UP = "The 15 minutes to edit that message are up. Your words are still here to send as a new message.";

/** A chat holds 3 pinned messages; a fourth takes the oldest one's place (WhatsApp). */
export const MAX_PINNED_MESSAGES = 3;

export const canDeleteForEveryone = (m: Message, uid: string, now = Date.now()) => m.senderUid === uid && !m.deleted && now - new Date(m.createdAt).getTime() < MESSAGE_DELETE_WINDOW_MS;
