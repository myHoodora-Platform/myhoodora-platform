import { dueHostNotice, dueReminder, eventDateProblem, hasEnded } from "./event-time";

const H = 60 * 60 * 1000;
const now = new Date("2026-10-01T09:00:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * H);
const going = (extra: Partial<{ updatedAt: Date; remindersSent: string[] }> = {}) => ({ status: "going" as const, updatedAt: at(-24), ...extra });
const interested = (extra: Partial<{ updatedAt: Date; remindersSent: string[] }> = {}) => ({ status: "interested" as const, updatedAt: at(-24), ...extra });

describe("eventDateProblem", () => {
  it("refuses last month and more than a year ahead, allows 'starting now'", () => {
    expect(eventDateProblem(at(-24 * 30), now)).toMatch(/already passed/);
    expect(eventDateProblem(at(-0.5), now)).toBeNull();
    expect(eventDateProblem(at(24 * 367), now)).toMatch(/year ahead/);
    expect(eventDateProblem(at(24 * 7), now)).toBeNull();
    expect(eventDateProblem(new Date("nope"), now)).toMatch(/valid date/);
  });
});

describe("hasEnded", () => {
  it("ends 3 hours after the start", () => {
    expect(hasEnded(at(-2.9), now)).toBe(false);
    expect(hasEnded(at(-3), now)).toBe(true);
    expect(hasEnded(undefined, now)).toBe(false);
  });
});

describe("dueReminder", () => {
  it("Going: 2-day reminder inside 48 h, final inside 3 h", () => {
    expect(dueReminder(at(47), going(), now)).toBe("going_2d");
    expect(dueReminder(at(49), going(), now)).toBeNull();
    expect(dueReminder(at(2.5), going(), now)).toBe("going_final");
    expect(dueReminder(at(2.5), going({ remindersSent: ["going_final"] }), now)).toBeNull();
  });

  it("a late RSVP still gets the final reminder, but not a 2-day one right after tapping Going", () => {
    expect(dueReminder(at(20), going({ updatedAt: at(-0.1) }), now)).toBeNull();
    expect(dueReminder(at(20), going({ updatedAt: at(-1) }), now)).toBe("going_2d");
    expect(dueReminder(at(1), going({ updatedAt: at(-0.1) }), now)).toBe("going_final");
  });

  it("Interested: one nudge the day before, nothing else", () => {
    expect(dueReminder(at(20), interested(), now)).toBe("interested_1d");
    expect(dueReminder(at(30), interested(), now)).toBeNull();
    expect(dueReminder(at(2), interested(), now)).toBeNull();
    expect(dueReminder(at(-15), interested(), now)).toBeNull();
  });

  it("Going: a follow-up the morning after, once, and never during or right after", () => {
    expect(dueReminder(at(-1), going(), now)).toBeNull(); // happening now
    expect(dueReminder(at(-6), going(), now)).toBeNull(); // ended 3 h ago
    expect(dueReminder(at(-15), going(), now)).toBe("followup"); // ended 12 h ago
    expect(dueReminder(at(-15), going({ remindersSent: ["followup"] }), now)).toBeNull();
    expect(dueReminder(at(-60), going(), now)).toBeNull(); // too old
  });

  it("an earlier window that was missed doesn't fire late (2-day isn't sent inside 3 h)", () => {
    expect(dueReminder(at(2), going(), now)).toBe("going_final");
  });
});

describe("dueHostNotice", () => {
  it("host gets a 2-day heads-up and a next-morning recap prompt, once each", () => {
    expect(dueHostNotice(at(40), [], now)).toBe("host_2d");
    expect(dueHostNotice(at(40), ["host_2d"], now)).toBeNull();
    expect(dueHostNotice(at(-15), ["host_2d"], now)).toBe("host_followup");
    expect(dueHostNotice(at(-15), ["host_2d", "host_followup"], now)).toBeNull();
  });
});
