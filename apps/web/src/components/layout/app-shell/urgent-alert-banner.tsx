"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useFeed } from "@/features/feed/feed-context";
import { alertCategoryDef, isUrgentAlert } from "@/features/feed/categories";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";

const DISMISSED_KEY = "mh:dismissed-urgent";

function readDismissed(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Nextdoor's "red state": an urgent alert from the last 2 hours takes over
 * the top of every screen until dismissed (per session).
 */
export function UrgentAlertBanner() {
  const { posts } = useFeed();
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readDismissed(),
  );
  const alert = posts.find((p) => isUrgentAlert(p) && !dismissed.includes(p._id));
  if (!alert) return null;

  const def = alertCategoryDef(alert.meta.alertCategory);
  const dismiss = () => {
    const next = [...dismissed, alert._id];
    setDismissed(next);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private mode — dismissal just won't survive a reload.
    }
  };

  return (
    <div role="alert" className="bg-destructive text-white">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5 lg:px-6">
        <def.icon className="size-5 shrink-0" aria-hidden />
        <Link href={ROUTES.post(alert._id)} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 font-bold">Urgent · {def.label}</span>
          <span className="truncate opacity-90">{alert.message}</span>
          <span className="hidden shrink-0 opacity-75 sm:inline">{timeAgo(alert.createdAt)}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss alert"
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
