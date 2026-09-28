"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@myhoodora/ui/popover";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { HeaderIconButton } from "@/components/layout/app-shell/header-icon-button";
import { NotificationItem } from "./notification-item";
import { useNotifications } from "./use-notifications";

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const latest = items.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <HeaderIconButton
          icon={Bell}
          label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          badge={unreadCount}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-base font-bold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {latest.map((n) => (
              <NotificationItem
                key={n._id}
                item={n}
                compact
                onOpen={(id) => {
                  setOpen(false);
                  void markRead(id);
                }}
              />
            ))}
          </div>
        )}
        <Link
          href={ROUTES.notifications}
          onClick={() => setOpen(false)}
          className="mt-1 block rounded-lg px-3 py-2.5 text-center text-sm font-bold text-primary hover:bg-primary/5"
        >
          See all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
