/**
 * The Post schema has no dedicated date/location fields (tracked in
 * apps/api/README.md TODOs), so an event's date/location are encoded into
 * the one `content` string field behind a machine-parseable prefix. This is
 * real, round-tripping data — not a display-only trick — it just lives
 * inside the same text field the backend already stores.
 */
export interface EventMeta {
  date?: string; // ISO datetime-local string, e.g. "2026-11-20T09:00"
  location?: string;
}

const PREFIX = "<!--event:";
const SUFFIX = "-->";

export function encodeEventContent(message: string, meta: EventMeta): string {
  if (!meta.date && !meta.location) return message;
  return `${PREFIX}${JSON.stringify(meta)}${SUFFIX}\n${message}`;
}

export function decodeEventContent(content: string): {
  message: string;
  meta: EventMeta | null;
} {
  if (!content.startsWith(PREFIX)) return { message: content, meta: null };
  const end = content.indexOf(SUFFIX);
  if (end === -1) return { message: content, meta: null };

  try {
    const meta = JSON.parse(content.slice(PREFIX.length, end)) as EventMeta;
    const message = content.slice(end + SUFFIX.length).replace(/^\n/, "");
    return { message, meta };
  } catch {
    return { message: content, meta: null };
  }
}

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
