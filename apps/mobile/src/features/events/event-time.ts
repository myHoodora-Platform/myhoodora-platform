import { clock } from "@/shared/utils/time";

/**
 * Event timing, as the web and the API have it (contract §23): an event has no end time, so it's
 * treated as lasting 3 hours. "Happening now" from its start until then, "Ended" after.
 */
export const EVENT_LENGTH_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const YEAR_MS = 366 * 24 * HOUR_MS;

export type EventPhase = "upcoming" | "today" | "live" | "ended";

export const eventEndsAt = (startIso: string) => new Date(new Date(startIso).getTime() + EVENT_LENGTH_MS);

export function eventPhase(startIso: string | undefined, now = new Date()): EventPhase {
  if (!startIso) return "upcoming";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "upcoming";
  if (now >= eventEndsAt(startIso)) return "ended";
  if (now >= start) return "live";
  return start.toDateString() === now.toDateString() ? "today" : "upcoming";
}

export const PHASE_LABEL: Record<EventPhase, string | null> = { upcoming: null, today: "Today", live: "Happening now", ended: "Ended" };

/** The window the API accepts: not in the past (an hour's grace) and at most a year ahead. */
export function eventDateProblem(start: Date | null, now = new Date()): string | null {
  if (!start || Number.isNaN(start.getTime())) return "Choose when it starts.";
  if (start.getTime() < now.getTime() - HOUR_MS) return "That date has already passed.";
  if (start.getTime() > now.getTime() + YEAR_MS) return "Events can be up to a year ahead.";
  return null;
}

/** The first sentence (or line) of the post doubles as the event's title, as on the web. */
export function eventTitle(message: string): { title: string; rest: string } {
  const text = message.trim();
  const end = text.search(/[.!?\n]/);
  const cut = end === -1 ? text.length : end + (text[end] === "\n" ? 0 : 1);
  const title = text.slice(0, cut).trim();
  if (title.length > 90) return { title: `${title.slice(0, 87).trimEnd()}…`, rest: text };
  return { title, rest: text.slice(cut).trim() };
}

/** For the calendar-page badge: "OCT", "4", "Sat". */
export function dateBadge(iso: string): { month: string; day: string; weekday: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
  };
}

/** "Sat 4 Oct, 4:00 pm" (with the year when it isn't this year's). */
export function eventWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }) });
  return `${day.replace(",", "")}, ${clock(iso)}`;
}

/**
 * Events posted before dates were required have none. One counts as upcoming for this long after it
 * was posted (it was usually "this Saturday"), then as past, so it can't sit in Upcoming for ever.
 */
export const UNDATED_UPCOMING_DAYS = 14;

/** Over: ended, or undated and posted more than two weeks ago. */
export function isPastEvent(e: { eventDate?: string; createdAt?: string }, now = new Date()): boolean {
  if (e.eventDate) return eventEndsAt(e.eventDate) <= now;
  const posted = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
  return !Number.isNaN(posted) && now.getTime() - posted > UNDATED_UPCOMING_DAYS * 24 * HOUR_MS;
}

/** Upcoming soonest first (one on now stays until it ends; undated last); past most recent first. */
export function splitEvents<T extends { eventDate?: string; createdAt?: string }>(events: T[], now = new Date()): { upcoming: T[]; past: T[] } {
  const when = (e: T) => e.eventDate ?? e.createdAt ?? "";
  return {
    upcoming: events.filter((e) => !isPastEvent(e, now)).sort((a, b) => (a.eventDate ?? "9").localeCompare(b.eventDate ?? "9")),
    past: events.filter((e) => isPastEvent(e, now)).sort((a, b) => when(b).localeCompare(when(a))),
  };
}
