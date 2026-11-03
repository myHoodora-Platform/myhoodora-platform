/**
 * Event timing rules (contract §23). There's no end-time field, so an event
 * is treated as lasting a few hours, like Meetup and Facebook do.
 */

const HOUR = 60 * 60 * 1000;
export const EVENT_LENGTH_MS = 3 * HOUR;
/** "Starting right now" is still allowed when posting. */
export const EVENT_START_GRACE_MS = 1 * HOUR;
export const EVENT_MAX_AHEAD_MS = 366 * 24 * HOUR;

export const eventEndsAt = (start: Date) => new Date(start.getTime() + EVENT_LENGTH_MS);
export const hasEnded = (start: Date | undefined, now = new Date()) => !!start && now.getTime() >= eventEndsAt(start).getTime();

/** Why a date can't be used for a new event, or null when it's fine. */
export function eventDateProblem(start: Date, now = new Date()): string | null {
  if (Number.isNaN(start.getTime())) return "Add a valid date and time.";
  if (start.getTime() < now.getTime() - EVENT_START_GRACE_MS) return "That date has already passed.";
  if (start.getTime() > now.getTime() + EVENT_MAX_AHEAD_MS) return "Events can be up to a year ahead.";
  return null;
}

export const REMINDER_KINDS = ["going_2d", "going_final", "interested_1d", "followup"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** A just-made RSVP doesn't get an immediate "reminder" for something they literally just chose. */
const FRESH_RSVP_MS = 30 * 60 * 1000;

/**
 * Which reminder (at most one) is due now for one person's RSVP. The
 * scheduler claims it exactly once (`remindersSent`), so this only decides
 * timing. Windows (user decision):
 * - Going: 2 days before, then a final one 3 hours before.
 * - Interested: the day before.
 * - Going, after it ended: a follow-up 9–48 h later (next morning for an evening event).
 */
export function dueReminder(
  start: Date,
  rsvp: { status: "going" | "interested"; updatedAt?: Date; remindersSent?: string[] },
  now = new Date(),
): ReminderKind | null {
  const until = start.getTime() - now.getTime();
  const sinceEnd = now.getTime() - eventEndsAt(start).getTime();
  const sent = new Set(rsvp.remindersSent ?? []);
  const settled = !rsvp.updatedAt || now.getTime() - rsvp.updatedAt.getTime() >= FRESH_RSVP_MS;
  const due = (kind: ReminderKind) => (sent.has(kind) ? null : kind);

  if (rsvp.status === "going") {
    if (until > 0 && until <= 3 * HOUR) return due("going_final");
    if (until > 3 * HOUR && until <= 48 * HOUR && settled) return due("going_2d");
    if (sinceEnd >= 9 * HOUR && sinceEnd <= 48 * HOUR) return due("followup");
    return null;
  }
  if (until > 3 * HOUR && until <= 24 * HOUR && settled) return due("interested_1d");
  return null;
}

/** The host's own notices: a 2-day heads-up with numbers, and the next-morning recap prompt. */
export function dueHostNotice(start: Date, sent: string[] = [], now = new Date()): "host_2d" | "host_followup" | null {
  const until = start.getTime() - now.getTime();
  const sinceEnd = now.getTime() - eventEndsAt(start).getTime();
  if (until > 3 * HOUR && until <= 48 * HOUR && !sent.includes("host_2d")) return "host_2d";
  if (sinceEnd >= 9 * HOUR && sinceEnd <= 48 * HOUR && !sent.includes("host_followup")) return "host_followup";
  return null;
}
