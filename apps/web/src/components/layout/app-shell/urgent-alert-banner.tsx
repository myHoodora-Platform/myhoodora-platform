"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useFeed } from "@/features/feed/feed-context";
import { alertCategoryDef, isUrgentAlert } from "@/features/feed/categories";
import { useBlocked } from "@/hooks/use-blocked";
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
 * Nextdoor's "red state": urgent alerts (last 2h, not resolved) take over the
 * top of every screen. Never stacks: several urgent alerts share one strip.
 * Dismissing hides the current ones for this session; a NEW urgent alert
 * brings the strip back.
 */
export function UrgentAlertBanner() {
  const { posts } = useFeed();
  const blocked = useBlocked();
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readDismissed(),
  );
  const urgent = posts.filter((p) => isUrgentAlert(p) && !blocked.has(p.authorUid) && !dismissed.includes(p._id));
  if (urgent.length === 0) return null;

  const latest = urgent[0]!;
  const def = alertCategoryDef(latest.meta.alertCategory);
  const many = urgent.length > 1;
  const kinds = Array.from(new Set(urgent.map((p) => alertCategoryDef(p.meta.alertCategory).label)));

  const dismiss = () => {
    const next = [...dismissed, ...urgent.map((p) => p._id)];
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
        <Link
          href={many ? ROUTES.alerts : ROUTES.post(latest._id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          {many ? (
            <>
              <span className="shrink-0 font-bold">{urgent.length} urgent alerts</span>
              <span className="truncate opacity-90">{kinds.join(" · ")}. Tap to see them all</span>
            </>
          ) : (
            <>
              <span className="shrink-0 font-bold">Urgent · {def.label}</span>
              <span className="truncate opacity-90">{latest.message}</span>
              <span className="hidden shrink-0 opacity-75 sm:inline">{timeAgo(latest.createdAt)}</span>
            </>
          )}
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss urgent alerts"
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
