"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { LayoutDashboard } from "lucide-react";

interface HeaderActionsProps {
  className?: string;
  /** "inline" for the desktop bar, "stack" for the full-width mobile menu. */
  layout?: "inline" | "stack";
}

export function HeaderActions({
  className,
  layout = "inline",
}: HeaderActionsProps) {
  const { user, profile, authReady } = useAuth();
  const isStack = layout === "stack";

  // Reserve space only until auth state is resolved (fast). The full
  // session/profile sync continues in the background and must not block the
  // header from showing the correct logged-in/logged-out state.
  if (!authReady) {
    return (
      <div
        className={cn(
          "animate-fade-in items-center gap-3",
          isStack ? "flex w-full flex-col" : "flex",
          className,
        )}
      >
        <Skeleton
          className={cn(
            "h-9 rounded-xl",
            isStack ? "w-full" : "w-20",
            !isStack && "hidden sm:block",
          )}
        />
        <Skeleton className={cn("h-9 rounded-xl", isStack ? "w-full" : "w-24")} />
      </div>
    );
  }

  if (user) {
    const initial = (profile?.displayName || user.email || "?")
      .charAt(0)
      .toUpperCase();
    const name = profile?.displayName || user.email?.split("@")[0];

    return (
      <div
        className={cn(
          "animate-fade-in items-center gap-3",
          isStack ? "flex w-full flex-col" : "flex",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold",
            isStack && "w-full justify-center",
          )}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
            {initial}
          </div>
          <span className="max-w-[140px] truncate">{name}</span>
        </div>

        <Link href="/dashboard" className={isStack ? "w-full" : undefined}>
          <Button
            size="sm"
            className={cn("gap-2 font-semibold", isStack && "w-full")}
          >
            <LayoutDashboard className="size-4" />
            <span>Dashboard</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-fade-in items-center gap-3",
        isStack ? "flex w-full flex-col" : "flex",
        className,
      )}
    >
      {isStack ? (
        <>
          <Link href="/login" className="w-full">
            <Button variant="outline" size="sm" className="w-full">
              Log in
            </Button>
          </Link>
          <Link href="/register" className="w-full">
            <Button size="sm" className="w-full">
              Sign up
            </Button>
          </Link>
        </>
      ) : (
        <>
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Sign up</Button>
          </Link>
        </>
      )}
    </div>
  );
}
