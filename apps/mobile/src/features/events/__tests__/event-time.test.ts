import { withRsvp } from "../events-api";
import { eventPhase, eventTitle, splitEvents } from "../event-time";

describe("event phases (an event lasts 3 hours, as on the web and the API)", () => {
  const start = "2026-11-01T16:00:00";
  it("upcoming, today, happening now, ended", () => {
    expect(eventPhase(start, new Date("2026-10-30T10:00:00"))).toBe("upcoming");
    expect(eventPhase(start, new Date("2026-11-01T09:00:00"))).toBe("today");
    expect(eventPhase(start, new Date("2026-11-01T18:59:00"))).toBe("live");
    expect(eventPhase(start, new Date("2026-11-01T19:00:00"))).toBe("ended");
    expect(eventPhase(undefined)).toBe("upcoming");
  });
  it("one that's on now stays upcoming; past ones go newest first", () => {
    const now = new Date("2026-11-01T17:00:00");
    const { upcoming, past } = splitEvents(
      [{ eventDate: "2026-11-05T10:00:00" }, { eventDate: start }, { eventDate: "2026-10-01T10:00:00" }, { eventDate: "2026-10-20T10:00:00" }, {}],
      now,
    );
    expect(upcoming.map((e) => e.eventDate)).toEqual([start, "2026-11-05T10:00:00", undefined]);
    expect(past.map((e) => e.eventDate)).toEqual(["2026-10-20T10:00:00", "2026-10-01T10:00:00"]);
  });
});

it("the first sentence or line is the title", () => {
  expect(eventTitle("Estate clean-up. Bring gloves.")).toEqual({ title: "Estate clean-up.", rest: "Bring gloves." });
  expect(eventTitle("Residents meeting\nAgenda: the gate")).toEqual({ title: "Residents meeting", rest: "Agenda: the gate" });
});

it("RSVP counts move with your answer", () => {
  const s = { postId: "p", goingCount: 3, interestedCount: 1, myStatus: null };
  const going = withRsvp(s, "going");
  expect(going).toMatchObject({ goingCount: 4, interestedCount: 1, myStatus: "going" });
  expect(withRsvp(going, "interested")).toMatchObject({ goingCount: 3, interestedCount: 2, myStatus: "interested" });
  expect(withRsvp(going, null)).toMatchObject({ goingCount: 3, interestedCount: 1, myStatus: null });
});
