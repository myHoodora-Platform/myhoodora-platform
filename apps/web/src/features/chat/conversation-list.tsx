"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useMockChanges } from "@/hooks/use-mock-changes";
import { useViewer } from "@/hooks/use-neighbourhood";
import { listConversations } from "@/lib/api/chat";
import { resolveAuthor } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Conversation } from "@/lib/api/types";

export function otherParticipant(convo: Conversation, myUid: string): string {
  return convo.participantUids.find((u) => u !== myUid) ?? myUid;
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const { user } = useAuth();
  const viewer = useViewer();
  const version = useMockChanges("chat:");
  const [items, setItems] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (user) void listConversations(user).then(setItems).catch(() => setItems([]));
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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <MessageCircle className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-bold">No messages yet</p>
        <p className="text-sm text-muted-foreground">
          Message a seller from For Sale &amp; Free, or a neighbour from their profile.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2">
      {items.map((c) => {
        const other = resolveAuthor(otherParticipant(c, user!.uid), viewer);
        const unread = c.unreadCount > 0;
        const mine = c.lastMessage?.senderUid === user?.uid;
        return (
          <li key={c._id}>
            <Link
              href={ROUTES.conversation(c._id)}
              aria-current={activeId === c._id ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted",
                activeId === c._id && "bg-muted",
              )}
            >
              <UserAvatar person={other} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>{other.displayName}</p>
                  {c.lastMessage && (
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessage.createdAt)}</span>
                  )}
                </div>
                {c.context && <p className="truncate text-xs font-semibold text-primary">{c.context.title}</p>}
                <p className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {c.lastMessage ? `${mine ? "You: " : ""}${c.lastMessage.body}` : "No messages yet"}
                </p>
              </div>
              {unread && <span className="size-2.5 shrink-0 rounded-full bg-brand-coral" aria-label="Unread" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
