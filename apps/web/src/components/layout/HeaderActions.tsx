"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { LayoutDashboard } from "lucide-react";

export function HeaderActions() {
  const { user, profile, loading } = useAuth();

  if (user && !loading) {
    const userInitial = (profile?.displayName || user.email || "?")
      .charAt(0)
      .toUpperCase();

    return (
      <div className="flex items-center gap-3 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shrink-0">
            {userInitial}
          </div>
          <span className="max-w-[120px] truncate hidden sm:inline-block">
            {profile?.displayName || user.email?.split("@")[0]}
          </span>
        </div>

        <Link href="/dashboard">
          <Button size="sm" className="gap-2 font-semibold">
            <LayoutDashboard className="size-4" />
            <span>Dashboard</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
          Log in
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="default" size="sm">
          Sign up
        </Button>
      </Link>
    </div>
  );
}
