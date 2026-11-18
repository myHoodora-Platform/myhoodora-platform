"use client";

import { useEffect, useState } from "react";
import {
  nextSeasonChange,
  seasonIsOn,
  type Season,
} from "@myhoodora/api-contract/seasons";
import { getAppConfig } from "@/lib/api/app-config";
import { festiveEffectsOn, onFestiveEffectsChange } from "./festive-prefs";

/** Timers longer than this aren't trusted by browsers (they fire at once); wait in steps instead. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * The festive season on right now (null otherwise), switching on and off at the minute without a reload.
 * `effects`: whether moving decorations may run (the person's switch, and their reduced-motion setting).
 */
export function useSeason(): {
  season: Season | null;
  effects: boolean;
  reducedMotion: boolean;
} {
  const [season, setSeason] = useState<Season | null>(null);
  const [, setTick] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let live = true;
    void getAppConfig().then((c) => live && setSeason(c?.season ?? null));
    setEnabled(festiveEffectsOn());
    const off = onFestiveEffectsChange(() => setEnabled(festiveEffectsOn()));
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onMq = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onMq);
    return () => {
      live = false;
      off();
      mq.removeEventListener("change", onMq);
    };
  }, []);

  // One timer to the next switch on or off.
  useEffect(() => {
    const wait = nextSeasonChange(season);
    if (wait === null) return;
    const id = setTimeout(
      () => setTick((n) => n + 1),
      Math.min(wait + 500, MAX_TIMER_MS),
    );
    return () => clearTimeout(id);
  });

  const on = seasonIsOn(season) ? season : null;
  return { season: on, effects: Boolean(on) && enabled, reducedMotion };
}
