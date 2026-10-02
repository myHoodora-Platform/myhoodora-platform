"use client";

import Link from "next/link";
import { AlertTriangle, Gavel, Megaphone, MessageCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { timeAgo } from "@/lib/time";
import type { AppNotification, NotificationType } from "@/lib/api/types";

const TYPE_ICON: Partial<Record<NotificationType, { icon: LucideIcon; tone: string }>> = {
  alert: { icon: AlertTriangle, tone: "bg-danger-soft text-destructive" },
  verification: { icon: ShieldAlert, tone: "bg-warning-soft text-warning" },
  message: { icon: MessageCircle, tone: "bg-primary/10 text-primary" },
  moderation: { icon: Gavel, tone: "bg-warning-soft text-warning" },
  system: { icon: Megaphone, tone: "bg-primary/10 text-primary" },
};

interface NotificationItemProps {
  item: AppNotification;
  onOpen: (id: string) => void;
  compact?: boolean;
}

/** One row: avatar/icon · "Name: title — snippet" · time · unread dot (Nextdoor layout). */
export function NotificationItem({ item, onOpen, compact }: NotificationItemProps) {
  const viewer = useViewer();
  const actor = item.actorUid ? resolveAuthor(item.actorUid, viewer) : null;
  const typeIcon = TYPE_ICON[item.type];
  // Actor-led phrasing for social events ("Ada commented on your post").
  const actorLed = item.type === "comment" || item.type === "message" || item.type === "reaction";

  return (
    <Link
      href={item.href}
      onClick={() => onOpen(item._id)}
      className={cn(
        "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        !item.read && "bg-primary/[0.04]",
      )}
    >
      <div className="relative shrink-0">
        {actor && actorLed ? (
          <UserAvatar person={actor} size={compact ? "sm" : "md"} />
        ) : typeIcon ? (
          <span className={cn("flex items-center justify-center rounded-full", compact ? "size-8" : "size-10", typeIcon.tone)}>
            <typeIcon.icon className="size-4" aria-hidden />
          </span>
        ) : actor ? (
          <UserAvatar person={actor} size={compact ? "sm" : "md"} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-foreground", compact ? "line-clamp-2" : "line-clamp-3")}>
          {actorLed && actor ? (
            <>
              <span className="font-bold">{actor.displayName}</span> {item.title}
            </>
          ) : (
            <span className="font-bold">{item.title}</span>
          )}
          {item.body && <span className="text-muted-foreground">: {item.body}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
      </div>
      {!item.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand-coral" aria-label="Unread" />}
    </Link>
  );
}
