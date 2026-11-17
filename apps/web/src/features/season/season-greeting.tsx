"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  countdownParts,
  SEASON_PALETTES,
} from "@myhoodora/api-contract/seasons";
import { useComposer } from "@/features/feed/composer-context";
import { FestiveMascot } from "./festive-mascot";
import { dismissGreeting, greetingDismissed } from "./festive-prefs";
import { useSeason } from "./use-season";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The season's card at the top of the feed: the mascot in its hat, the greeting, the admins'
 * illustration (with its credit), the New Year countdown, and a nudge to share a festive post. Closed
 * once, it stays closed for the season. Shown even with effects off: it's content, not decoration.
 */
export function SeasonGreeting() {
  const { season } = useSeason();
  const { openComposer } = useComposer();
  const [closed, setClosed] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (season) setClosed(greetingDismissed(season.key));
  }, [season]);
  const counting = countdownParts(season?.countdownTo, now);
  useEffect(() => {
    if (!season?.countdownTo) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [season?.countdownTo]);

  if (!season || closed || (!season.greeting && !season.image && !counting))
    return null;
  return (
    <section
      aria-label="Season's greetings"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 pt-5"
    >
      {/* A ribbon in the season's colours: festive, where a coloured outline (red at Christmas) read as an error. */}
      <div aria-hidden className="absolute inset-x-0 top-0 flex h-1">
        {SEASON_PALETTES[season.accent].map((c) => (
          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          dismissGreeting(season.key);
          setClosed(true);
        }}
        className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Close the greeting"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-4 pr-6">
        <FestiveMascot hat={season.mascot} className="mt-2 size-14" />
        <div className="min-w-0 flex-1">
          {season.greeting?.title && (
            <h2 className="text-lg font-bold">{season.greeting.title}</h2>
          )}
          {season.greeting?.body && (
            <p className="mt-1 text-sm text-muted-foreground">
              {season.greeting.body}
            </p>
          )}
          {counting && (
            <p
              className="mt-3 text-2xl font-bold tabular-nums"
              aria-live="off"
            >
              {pad(counting.hours)}:{pad(counting.minutes)}:
              {pad(counting.seconds)}{" "}
              <span className="font-sans text-sm font-medium text-muted-foreground">
                to midnight
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={() => openComposer()}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ImagePlus className="size-4 shrink-0" aria-hidden /> Share a festive moment
          </button>
        </div>
      </div>
      {season.image && (
        <figure className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- an admin-uploaded illustration or GIF (GIFs must stay animated) */}
          <img
            src={season.image.url}
            alt=""
            className="max-h-56 w-full rounded-xl object-contain"
          />
          {season.image.credit && (
            <figcaption className="mt-1 text-right text-[11px] text-muted-foreground">
              {season.image.credit}
            </figcaption>
          )}
        </figure>
      )}
    </section>
  );
}
