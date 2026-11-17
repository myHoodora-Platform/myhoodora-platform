/**
 * Festive seasons (docs/product/hood-activation-plan.md WP-D): a look the apps put on between two
 * admin-set times, Lagos time. Pure rules here; storage in seasons.service.ts.
 */
export const SEASON_EFFECTS = ["lights", "sparkle", "fireworks", "none"] as const;
export type SeasonEffect = (typeof SEASON_EFFECTS)[number];
export const SEASON_INTENSITIES = ["subtle", "normal", "festive"] as const;
export type SeasonIntensity = (typeof SEASON_INTENSITIES)[number];
export const SEASON_MASCOTS = ["santa_hat", "party_hat", "none"] as const;
export type SeasonMascot = (typeof SEASON_MASCOTS)[number];
export const SEASON_ACCENTS = ["red", "green", "gold", "blue"] as const;
export type SeasonAccent = (typeof SEASON_ACCENTS)[number];

export interface SeasonLike {
  key: string;
  enabled: boolean;
  startsAt: Date;
  endsAt: Date;
}

/** How far ahead the apps are told about a season, so they switch on at the minute without asking again. */
export const SEASON_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

/**
 * The season to send: the one on now, else the next one starting within a day. Overlaps: the one that
 * started last wins (New Year's Eve inside a long December season).
 */
export function currentSeason<T extends SeasonLike>(seasons: readonly T[], now = new Date()): T | null {
  const on = seasons.filter((s) => s.enabled && s.startsAt <= now && now < s.endsAt).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  if (on[0]) return on[0];
  const soon = seasons
    .filter((s) => s.enabled && s.startsAt > now && s.startsAt.getTime() - now.getTime() <= SEASON_LOOKAHEAD_MS)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return soon[0] ?? null;
}

/** 00:00 on a Lagos calendar day (WAT, UTC+1, no daylight saving) as an instant. */
export const lagos = (y: number, month: number, day: number, hour = 0) => new Date(Date.UTC(y, month - 1, day, hour - 1));

/** The two seasons every year starts with (plan WP-D); admins change or add to them. */
export function defaultSeasons(year: number) {
  return [
    {
      key: `christmas-${year}`,
      label: `Christmas ${year}`,
      enabled: true,
      startsAt: lagos(year, 12, 15),
      endsAt: lagos(year, 12, 27),
      effect: "lights" as SeasonEffect,
      intensity: "normal" as SeasonIntensity,
      mascot: "santa_hat" as SeasonMascot,
      accent: "red" as SeasonAccent,
      greetingTitle: "Merry Christmas, neighbours! 🎄",
      greetingBody: "From all of us at myHoodora: peace, good food and good company on your street this Christmas. Share a festive photo with your Hood!",
      countdownTo: null,
    },
    {
      key: `new-year-${year + 1}`,
      label: `New Year ${year + 1}`,
      enabled: true,
      startsAt: lagos(year, 12, 31, 18),
      endsAt: lagos(year + 1, 1, 2),
      effect: "fireworks" as SeasonEffect,
      intensity: "festive" as SeasonIntensity,
      mascot: "party_hat" as SeasonMascot,
      accent: "gold" as SeasonAccent,
      greetingTitle: `Happy New Year ${year + 1}! 🎆`,
      greetingBody: "Thank you for looking out for each other this year. Here's to a safer, friendlier neighbourhood in the year ahead.",
      countdownTo: lagos(year + 1, 1, 1),
    },
  ];
}
