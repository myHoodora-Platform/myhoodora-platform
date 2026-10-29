/**
 * "Add to calendar" for events, shared by the web and the app: the entry itself, an iCalendar (.ics)
 * file (Google Calendar, Apple Calendar and Outlook all open it) and Google Calendar's "new event" page.
 * An event has no end time (contract §23), so it's entered as lasting 3 hours, as everywhere else.
 */
export const CALENDAR_EVENT_LENGTH_MS = 3 * 60 * 60 * 1000;

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  /** Back to the post on the web. */
  url?: string;
  description?: string;
}

/**
 * The calendar entry for an event post, or null when it has no usable date. `title` and `rest` are the
 * post split as the screens show it (first sentence, then the rest); `webUrl` is the site's origin.
 */
export function eventCalendar(
  post: { id: string; title: string; rest?: string; eventDate?: string; eventLocation?: string },
  webUrl: string,
): CalendarEvent | null {
  if (!post.eventDate) return null;
  const start = new Date(post.eventDate);
  if (Number.isNaN(start.getTime())) return null;
  return {
    id: post.id,
    title: post.title.replace(/[.!?]+$/, "").trim() || "Neighbourhood event",
    start,
    end: new Date(start.getTime() + CALENDAR_EVENT_LENGTH_MS),
    location: post.eventLocation?.trim() || undefined,
    url: `${webUrl.replace(/\/+$/, "")}/p/${post.id}`,
    description: post.rest?.trim() || undefined,
  };
}

/** 2026-10-31T15:00:00.000Z → 20261031T150000Z (UTC, as both Google and iCalendar take it). */
export const calendarStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** The description with the link back to the post, for calendars that have no link field. */
const details = (e: CalendarEvent) => [e.description, e.url && `On myHoodora: ${e.url}`].filter(Boolean).join("\n\n");

/** Google Calendar's "new event" page, filled in. Works anywhere with a browser. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const body = details(e);
  const q: [string, string][] = [
    ["action", "TEMPLATE"],
    ["text", e.title],
    ["dates", `${calendarStamp(e.start)}/${calendarStamp(e.end)}`],
    ...(body ? [["details", body] as [string, string]] : []),
    ...(e.location ? [["location", e.location] as [string, string]] : []),
  ];
  return `https://calendar.google.com/calendar/render?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** RFC 5545 text escaping (§3.3.11): backslash, comma, semicolon and line breaks. */
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** UTF-8 bytes in one character (this package has no TextEncoder: it runs on the web, the app and the API). */
const utf8Bytes = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
};

/** Lines over 75 bytes continue on the next line after a space (RFC 5545 §3.1), never mid-character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Bytes(ch);
    // Continuation lines start with a space, which counts.
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function eventIcs(e: CalendarEvent, now = new Date()): string {
  const body = details(e);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//myHoodora//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@myhoodora.com`,
    `DTSTAMP:${calendarStamp(now)}`,
    `DTSTART:${calendarStamp(e.start)}`,
    `DTEND:${calendarStamp(e.end)}`,
    `SUMMARY:${text(e.title)}`,
    ...(e.location ? [`LOCATION:${text(e.location)}`] : []),
    ...(body ? [`DESCRIPTION:${text(body)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    // A reminder in their own calendar app too, an hour before.
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** "Street clean-up!" → "Street clean-up.ics" */
export const icsFileName = (title: string) => `${title.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "event"}.ics`;
