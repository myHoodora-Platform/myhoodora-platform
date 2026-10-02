/**
 * Event timing on the web, matching the API (contract §23): an event has no
 * end-time field, so it's treated as lasting 3 hours.
 */
import type { Post } from "@/lib/api/types";
import type { CalendarEvent } from "@/lib/calendar";

export const EVENT_LENGTH_MS = 3 * 60 * 60 * 1000;
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export type EventPhase = "upcoming" | "today" | "live" | "ended";

export const eventEndsAt = (startIso: string) => new Date(new Date(startIso).getTime() + EVENT_LENGTH_MS);

/** Where an event is in its life, for labels ("Today", "Happening now", "Ended") and closing RSVPs. */
export function eventPhase(startIso: string | undefined, now = new Date()): EventPhase {
  if (!startIso) return "upcoming";
  const start = new Date(startIso);
  if (now >= eventEndsAt(startIso)) return "ended";
  if (now >= start) return "live";
  return start.toDateString() === now.toDateString() ? "today" : "upcoming";
}

/** Same window the API enforces: not in the past (1 h grace) and at most a year ahead. */
export function eventDateProblem(startIso: string, now = new Date()): string | null {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return "Add a valid date and time.";
  if (t < now.getTime() - 60 * 60 * 1000) return "That date has already passed.";
  if (t > now.getTime() + YEAR_MS) return "Events can be up to a year ahead.";
  return null;
}

/** The first sentence (or line) of the post doubles as the event title. */
export function eventTitle(post: Pick<Post, "message">): { title: string; rest: string } {
  const text = post.message.trim();
  const end = text.search(/[.!?\n]/);
  const cut = end === -1 ? text.length : end + (text[end] === "\n" ? 0 : 1);
  const title = text.slice(0, cut).trim();
  if (title.length > 90) return { title: `${title.slice(0, 87).trimEnd()}…`, rest: text };
  return { title, rest: text.slice(cut).trim() };
}

/** What "Add to calendar" needs from an event post. */
export function calendarFor(post: Pick<Post, "_id" | "message" | "meta">, origin = typeof window === "undefined" ? "" : window.location.origin): CalendarEvent | null {
  if (!post.meta.eventDate) return null;
  const { title, rest } = eventTitle(post);
  return {
    id: post._id,
    title: title.replace(/[.!?]+$/, ""),
    start: new Date(post.meta.eventDate),
    end: eventEndsAt(post.meta.eventDate),
    location: post.meta.eventLocation,
    url: `${origin}/p/${post._id}`,
    description: rest || undefined,
  };
}
