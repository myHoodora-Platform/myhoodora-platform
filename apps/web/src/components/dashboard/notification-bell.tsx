"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/context/FeedContext";
import { getLastSeenAlertAt, markAlertSeen } from "@/lib/feed/alert-seen";
import { timeAgo } from "@/lib/time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { Bell, ShieldAlert, AlertTriangle } from "lucide-react";

export function NotificationBell() {
  const { profile } = useAuth();
  const { posts } = useFeed();
  const isVerified = profile?.verificationStatus === "verified";
  const neighborhoodId = profile?.neighborhoodId;

  // No real push-notification backend exists yet (tracked in
  // apps/api/README.md TODOs) — this is an honest "new since you last
  // looked" check against the already-fetched feed, not a fake counter.
  const newestAlert = useMemo(() => {
    const alerts = posts.filter((p) => p.type === "alert");
    if (alerts.length === 0) return null;
    return alerts.reduce((newest, p) =>
      new Date(p.createdAt) > new Date(newest.createdAt) ? p : newest,
    );
  }, [posts]);

  const hasUnseenAlert =
    !!newestAlert &&
    !!neighborhoodId &&
    (() => {
      const lastSeen = getLastSeenAlertAt(neighborhoodId);
      return !lastSeen || new Date(newestAlert.createdAt) > new Date(lastSeen);
    })();

  const handleAlertClick = () => {
    if (newestAlert && neighborhoodId) {
      markAlertSeen(neighborhoodId, newestAlert.createdAt);
    }
  };

  const showDot = !isVerified || hasUnseenAlert;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="size-[18px]" />
          {showDot && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-white" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasUnseenAlert && newestAlert && (
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard?post=${newestAlert._id}`}
              onClick={handleAlertClick}
            >
              <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <p className="font-semibold">New safety alert</p>
                <p className="truncate text-xs text-muted-foreground">
                  {timeAgo(newestAlert.createdAt)}
                </p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}
        {!isVerified && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <ShieldAlert className="size-4 shrink-0 text-amber-600" />
              <span>Your address verification is pending</span>
            </Link>
          </DropdownMenuItem>
        )}
        {!hasUnseenAlert && isVerified && (
          <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
            You&apos;re all caught up.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
