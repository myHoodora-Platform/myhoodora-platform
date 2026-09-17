"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { Bell, ShieldAlert } from "lucide-react";

export function NotificationBell() {
  const { profile } = useAuth();
  const isVerified = profile?.verificationStatus === "verified";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="size-[18px]" />
          {!isVerified && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-white" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isVerified && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <ShieldAlert className="size-4 shrink-0 text-amber-600" />
              <span>Your address verification is pending</span>
            </Link>
          </DropdownMenuItem>
        )}
        <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
          {isVerified
            ? "You're all caught up."
            : "No other notifications yet."}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
