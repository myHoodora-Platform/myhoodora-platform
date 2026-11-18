import { nextSeasonChange, seasonIsOn, type Season } from "@myhoodora/api-contract/seasons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { useAppearance } from "@/core/preferences/appearance";
import { accountKeys, getAppConfig } from "@/features/account/account-api";

const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * The festive season on right now (null otherwise), from `GET /app-config` (contract §41), switching on
 * and off at the minute. `effects`: moving decorations may run (their switch and "reduce motion").
 */
export function useSeason(): { season: Season | null; effects: boolean; reducedMotion: boolean } {
  const config = useQuery({ queryKey: accountKeys.appConfig, queryFn: getAppConfig, staleTime: 60 * 60 * 1000 });
  const { festive } = useAppearance();
  const reducedMotion = useReducedMotion();
  const [, setTick] = useState(0);
  const season = config.data?.season ?? null;

  useEffect(() => {
    const wait = nextSeasonChange(season);
    if (wait === null) return;
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(wait + 500, MAX_TIMER_MS));
    return () => clearTimeout(id);
  });

  const on = seasonIsOn(season) ? season : null;
  return { season: on, effects: Boolean(on) && festive, reducedMotion };
}
