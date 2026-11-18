/**
 * Festive seasons (contract §41; plan WP-D). Admins set the dates and the look; `GET /app-config`
 * sends the season on now or starting within a day, and each app switches it on and off on time.
 */
export const SEASON_EFFECTS = ["lights", "sparkle", "fireworks", "none"] as const;
export type SeasonEffect = (typeof SEASON_EFFECTS)[number];
export const SEASON_INTENSITIES = ["subtle", "normal", "festive"] as const;
export type SeasonIntensity = (typeof SEASON_INTENSITIES)[number];
export const SEASON_MASCOTS = ["santa_hat", "party_hat", "none"] as const;
export type SeasonMascot = (typeof SEASON_MASCOTS)[number];
export const SEASON_ACCENTS = ["red", "green", "gold", "blue"] as const;
export type SeasonAccent = (typeof SEASON_ACCENTS)[number];

export const SEASON_EFFECT_LABELS: Record<SeasonEffect, string> = {
  lights: "Twinkling lights",
  sparkle: "Sparkles",
  fireworks: "Fireworks",
  none: "No effect",
};
export const SEASON_MASCOT_LABELS: Record<SeasonMascot, string> = { santa_hat: "Santa hat", party_hat: "Party hat", none: "Plain" };

/** Each accent's colours (bulbs, sparks, card edge), the same on web and mobile. */
export const SEASON_PALETTES: Record<SeasonAccent, string[]> = {
  red: ["#e53935", "#43a047", "#fdd835", "#1e88e5", "#ff7043"],
  green: ["#2e7d32", "#c62828", "#fbc02d", "#ffffff"],
  gold: ["#fbc02d", "#ffd54f", "#ff7043", "#ab47bc", "#29b6f6"],
  blue: ["#1e88e5", "#90caf9", "#ffffff", "#fdd835"],
};

/** How many particles each intensity may use (kept low for cheap phones and batteries). */
export const SEASON_PARTICLES: Record<SeasonIntensity, number> = { subtle: 10, normal: 18, festive: 24 };

/** In `GET /app-config` (`season`). */
export interface Season {
  key: string;
  startsAt: string;
  endsAt: string;
  effect: SeasonEffect;
  intensity: SeasonIntensity;
  mascot: SeasonMascot;
  accent: SeasonAccent;
  greeting: { title: string; body: string } | null;
  /** An illustration or GIF admins uploaded, with the credit its licence asks for. */
  image: { url: string; credit?: string } | null;
  /** New Year: when the countdown ends and the fireworks burst. */
  countdownTo: string | null;
}

/** Is it on at `now`? (The API also sends a season starting within a day.) */
export function seasonIsOn(season: Pick<Season, "startsAt" | "endsAt"> | null | undefined, now = Date.now()): boolean {
  if (!season) return false;
  return Date.parse(season.startsAt) <= now && now < Date.parse(season.endsAt);
}

/** Milliseconds until the season next switches on or off, to set one timer (null: nothing to wait for). */
export function nextSeasonChange(season: Pick<Season, "startsAt" | "endsAt"> | null | undefined, now = Date.now()): number | null {
  if (!season) return null;
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  if (now < start) return start - now;
  if (now < end) return end - now;
  return null;
}

/** "05:12:09" to the countdown (hours may pass 24), or null once it's over. */
export function countdownParts(to: string | null | undefined, now = Date.now()): { hours: number; minutes: number; seconds: number } | null {
  if (!to) return null;
  const left = Date.parse(to) - now;
  if (!(left > 0)) return null;
  const s = Math.floor(left / 1000);
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** GET /admin/seasons. */
export interface AdminSeason {
  _id: string;
  key: string;
  label: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  effect: SeasonEffect;
  intensity: SeasonIntensity;
  mascot: SeasonMascot;
  accent: SeasonAccent;
  greetingTitle: string;
  greetingBody: string;
  imageUrl?: string;
  imageCredit?: string;
  countdownTo: string | null;
  live: boolean;
  updatedAt?: string;
}

export type AdminSeasonInput = Partial<Omit<AdminSeason, "_id" | "live" | "updatedAt" | "imageUrl" | "imageCredit">> & { imageUrl?: string | null; imageCredit?: string | null };
