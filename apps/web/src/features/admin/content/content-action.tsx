"use client";

import { toast } from "sonner";
import { ActionDialog } from "@/components/admin/action-dialog";
import { useAuth } from "@/context/AuthContext";
import { actOnContent } from "@/lib/api/admin/content";
import { useAdminSession } from "../session";

export type ContentKind = "post" | "comment" | "listing" | "group";

export interface ContentTarget {
  type: ContentKind;
  id: string;
  label: string;
  action: "remove" | "restore";
}

const NOUN: Record<ContentKind, string> = { post: "post", comment: "comment", listing: "listing", group: "group" };

/** Remove / restore any piece of content, with the consequence spelled out. */
export function ContentActionDialog({ target, onClose, onDone }: { target: ContentTarget | null; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { role } = useAdminSession();
  if (!target) return null;
  const noun = NOUN[target.type];
  const remove = target.action === "remove";
  const verb = target.type === "group" ? (remove ? "Archive" : "Restore") : remove ? "Remove" : "Restore";

  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${verb} ${noun}`}
      consequence={
        remove
          ? target.type === "group"
            ? `“${target.label}” is hidden and closed to new posts. Members and posts are kept, and you can restore it.`
            : `“${target.label}” is hidden from neighbours. The author is told which guideline it broke. You can restore it later.`
          : `“${target.label}” becomes visible to neighbours again.`
      }
      reasons={remove ? ["Harassment or hate", "Scam or fraud", "Misinformation", "Spam or advertising", "Not about the neighbourhood", "Breaks community guidelines"] : ["Removed in error", "Appeal accepted", "Edited to meet guidelines"]}
      destructive={remove}
      confirmLabel={verb}
      onConfirm={async ({ reason, note }) => {
        if (!user) return;
        await actOnContent(user, target.type, target.id, { action: target.action, reason, note }, role);
        toast.success(`${verb}d ${noun}. It's in the moderation history.`);
        onDone();
      }}
    />
  );
}
