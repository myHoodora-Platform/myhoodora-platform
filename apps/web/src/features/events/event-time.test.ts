import { describe, expect, it } from "vitest";
import { eventIcs } from "@/lib/calendar";
import { pickFinalReminder, startsIn } from "./event-reminder-modal";
import { calendarFor, eventDateProblem, eventPhase } from "./event-time";
import type { AppNotification } from "@/lib/api/types";

const now = new Date("2026-10-01T09:00:00Z");
const iso = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

describe("eventPhase", () => {
  it("upcoming → today → happening now (3 h) → ended", () => {
    expect(eventPhase(iso(48), now)).toBe("upcoming");
    expect(eventPhase(iso(2), now)).toBe("today");
    expect(eventPhase(iso(-1), now)).toBe("live");
    expect(eventPhase(iso(-2.99), now)).toBe("live");
    expect(eventPhase(iso(-3), now)).toBe("ended");
    expect(eventPhase(undefined, now)).toBe("upcoming");
  });
});

describe("eventDateProblem", () => {
  it("matches the API window", () => {
    expect(eventDateProblem(iso(-24 * 30), now)).toMatch(/already passed/);
    expect(eventDateProblem(iso(-0.5), now)).toBeNull();
    expect(eventDateProblem(iso(24 * 367), now)).toMatch(/year ahead/);
  });
});

describe("calendar (.ics)", () => {
  it("builds a valid event with escaping, 3 h length and a 1 h alarm", () => {
    const post = { _id: "p1", message: "Road 12 clean-up. Gloves, bags; and zobo provided.", meta: { category: "event" as const, eventDate: "2026-10-04T15:00:00.000Z", eventLocation: "Road 12 park, by the tank" } };
    const cal = calendarFor(post, "https://myhoodora.com")!;
    const ics = eventIcs(cal, now);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261004T150000Z");
    expect(ics).toContain("DTEND:20261004T180000Z");
    expect(ics).toContain("SUMMARY:Road 12 clean-up\r\n");
    expect(ics).toContain("LOCATION:Road 12 park\\, by the tank");
    expect(ics).toContain("DESCRIPTION:Gloves\\, bags\\; and zobo provided.");
    expect(ics).toContain("URL:https://myhoodora.com/p/p1");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("reminder pop-up", () => {
  const n = (over: Partial<AppNotification>): AppNotification => ({ _id: "n", type: "event", title: "t", href: "/p/x", createdAt: now.toISOString(), read: false, ...over });
  it("shows only an unread final reminder that names its event", () => {
    expect(pickFinalReminder([n({ kind: "event_reminder", subjectId: "p1" })])).toBeNull();
    expect(pickFinalReminder([n({ kind: "event_reminder_final", subjectId: "p1", read: true })])).toBeNull();
    expect(pickFinalReminder([n({ kind: "event_reminder_final" })])).toBeNull();
    expect(pickFinalReminder([n({ _id: "a", kind: "event_reminder" }), n({ _id: "b", kind: "event_reminder_final", subjectId: "p1" })])?._id).toBe("b");
  });
  it("says how soon it starts", () => {
    expect(startsIn(iso(2.25), now)).toBe("in 2 h 15 min");
    expect(startsIn(iso(3), now)).toBe("in 3 h");
    expect(startsIn(iso(0.5), now)).toBe("in 30 min");
    expect(startsIn(iso(-0.1), now)).toBe("now");
  });
});
