/**
 * Tiny persistent store for endpoints the backend doesn't have yet.
 * Data lives in localStorage (per browser), so preview flows survive a
 * reload but are never shared between users — the UI labels these areas as
 * previews. Falls back to memory where storage is unavailable.
 */

import { ApiError, FRIENDLY_MESSAGES } from "../client";

// Bump when seed data changes shape so preview browsers re-seed cleanly.
const SEED_VERSION = 4;
const PREFIX = `mh-mock:v${SEED_VERSION}:`;
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    memory.set(key, value);
  }
}

export function load<T>(key: string, seed: () => T): T {
  // read() falls back to memory when storage is blocked (private mode, tests).
  const raw = read(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — reseed below.
    }
  }
  const initial = seed();
  if (typeof window !== "undefined") write(key, JSON.stringify(initial));
  return initial;
}

export function save<T>(key: string, value: T) {
  write(key, JSON.stringify(value));
  // Let other mounted hooks (e.g. unread badges) re-read.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mh-mock-change", { detail: key }));
  }
}

export function update<T>(key: string, seed: () => T, fn: (current: T) => T): T {
  const next = fn(load(key, seed));
  save(key, next);
  return next;
}

/**
 * Simulated network latency so loading states are exercised in previews.
 * Fails like the real client when the device is offline, so offline UX can
 * be tested in mock mode too.
 */
export async function latency(ms = 250): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(FRIENDLY_MESSAGES.offline, 0, "offline");
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export function daysFromNow(d: number, hour = 10): string {
  const date = new Date(Date.now() + d * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}
