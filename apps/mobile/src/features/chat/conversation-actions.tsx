import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Conversation, MuteLength } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Bell, BellOff, Flag, Pin, PinOff, ShoppingBag, Trash2, UserRound } from "lucide-react-native";
import { useState } from "react";

import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { ActionSheet, type ActionItem } from "@/shared/ui/action-sheet";
import { useToast } from "@/shared/ui/toast";
import { ReportSheet } from "@/features/feed/report-sheet";
import { archiveConversation, chatKeys, deleteConversation, isMuted, muteConversation, otherPerson, pinConversation } from "./chat-api";
import { showDialog } from "@/shared/ui/dialog";

const MUTE_CHOICES: { length: MuteLength; label: string; done: string }[] = [
  { length: "8h", label: "For 8 hours", done: "Muted for 8 hours." },
  { length: "1w", label: "For a week", done: "Muted for a week." },
  { length: "always", label: "Until I turn it back on", done: "Muted. Turn it back on from this menu." },
];

/**
 * What you can do with a conversation (long-press it in Messages, or ⋯ inside it): pin it to the top,
 * archive or bring it back, mute or unmute, delete it for you; inside it also their profile, the listing, and Report.
 */
export function ConversationActions({ convo, visible, onClose, inside = false, onGone }: { convo: Conversation; visible: boolean; onClose: () => void; inside?: boolean; onGone?: () => void }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [muting, setMuting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const other = otherPerson(convo, user.uid);
  const muted = isMuted(convo);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: chatKeys.all });
  };
  const patchConvo = (patch: Partial<Conversation>) => client.setQueryData<Conversation>(chatKeys.one(convo._id), (c) => (c ? { ...c, ...patch } : c));

  const archive = async (archived: boolean) => {
    try {
      await archiveConversation(user, convo._id, archived);
      patchConvo({ archived });
      refresh();
      toast(archived ? "Archived. A new message brings it back." : "Back in your messages.");
      if (archived) onGone?.();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const pin = async (pinned: boolean) => {
    try {
      await pinConversation(user, convo._id, pinned);
      patchConvo({ pinned });
      refresh();
      toast(pinned ? "Pinned to the top of Messages." : "Unpinned.");
    } catch (err) {
      // Past three, the API says so ("You can pin up to 3 chats. Unpin one first.").
      toast(errorMessage(err), "error");
    }
  };
  const mute = async (length: MuteLength, done: string) => {
    try {
      const { mutedUntil } = await muteConversation(user, convo._id, length);
      patchConvo({ mutedUntil: mutedUntil ?? undefined });
      refresh();
      toast(done);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const remove = () =>
    showDialog(`Delete this chat${other ? ` with ${other.displayName}` : ""}?`, "It's removed from your messages, with what was said so far. They keep their copy. If they write again, it comes back with only the new messages.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteConversation(user, convo._id);
            client.removeQueries({ queryKey: chatKeys.messages(convo._id) });
            refresh();
            toast("Chat deleted.");
            onGone?.();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        },
      },
    ]);

  const open: ActionItem[] = inside
    ? [
        ...(other ? [{ key: "profile", label: `${other.displayName}'s profile`, Icon: UserRound, onPress: () => router.push(`/u/${other.uid}`) }] : []),
        ...(convo.context ? [{ key: "listing", label: "View the listing", hint: convo.context.title, Icon: ShoppingBag, onPress: () => router.push(`/for-sale/${convo.context!.id}`) }] : []),
      ]
    : [];
  const manage: ActionItem[] = [
    ...(convo.archived
      ? []
      : [
          convo.pinned
            ? { key: "unpin", label: "Unpin chat", Icon: PinOff, onPress: () => void pin(false) }
            : { key: "pin", label: "Pin chat", hint: "Keep it at the top of Messages", Icon: Pin, onPress: () => void pin(true) },
        ]),
    muted
      ? { key: "unmute", label: "Unmute", hint: "Get notifications again", Icon: Bell, onPress: () => void mute("off", "Unmuted.") }
      : { key: "mute", label: "Mute", hint: "No notifications from this chat", Icon: BellOff, onPress: () => setTimeout(() => setMuting(true), 250) },
    convo.archived
      ? { key: "unarchive", label: "Move back to Messages", Icon: ArchiveRestore, onPress: () => void archive(false) }
      : { key: "archive", label: "Archive", hint: "Out of the way until there's something new", Icon: Archive, onPress: () => void archive(true) },
  ];
  const danger: ActionItem[] = [
    ...(inside && other ? [{ key: "report", label: "Report", Icon: Flag, destructive: true, onPress: () => setTimeout(() => setReporting(true), 250) }] : []),
    { key: "delete", label: "Delete chat", hint: "For you only", Icon: Trash2, destructive: true, onPress: remove },
  ];

  return (
    <>
      <ActionSheet visible={visible} onClose={onClose} label="Chat options" groups={[open, manage, danger].filter((g) => g.length)} />
      <ActionSheet
        visible={muting}
        onClose={() => setMuting(false)}
        label="Mute for how long?"
        groups={[MUTE_CHOICES.map((m) => ({ key: m.length, label: m.label, Icon: BellOff, onPress: () => void mute(m.length, m.done) }))]}
      />
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="message" targetId={convo._id} />
    </>
  );
}
