"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { challengeStrip, lagosToday, TIER_RING } from "@myhoodora/api-contract/engagement";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { useEngagement } from "./use-invites";

const hiddenKey = (day: string) => `myhoodora:challenge-strip-hidden:${day}`;

/**
 * A slim line at the top of the feed: the launch challenge or your streak, opening the Invite page.
 * The × hides it until tomorrow (Lagos time).
 */
export function ChallengeStrip() {
  const { user } = useAuth();
  const engagement = useEngagement(user?.uid);
  const strip = challengeStrip(engagement);
  const badge = engagement?.badge;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(hiddenKey(lagosToday())) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (!strip || hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(lagosToday()), "1");
    } catch {
      // Private mode: hidden for this visit only.
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-primary/25 bg-primary/5 pr-1 text-sm">
      <Link href={ROUTES.invite} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pl-3 hover:bg-primary/10">
        {/* The mascot, ringed in your badge's colour once you have one. */}
        <span className="size-8 shrink-0 overflow-hidden rounded-full bg-white" style={badge ? { boxShadow: `0 0 0 2px ${TIER_RING[badge.tier ?? "builder"]}` } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny local icon */}
          <img src="/logo/app-icon.png" alt="" className="size-full object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{strip.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{strip.detail}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden />
      </Link>
      <button type="button" onClick={hide} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Hide until tomorrow">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
