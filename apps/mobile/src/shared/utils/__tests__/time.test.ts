import { clock, dayLabel, timeAgo } from "../time";

const now = Date.parse("2026-10-20T12:00:00Z");
const ago = (s: number) => new Date(now - s * 1000).toISOString();

describe("timeAgo", () => {
  it("reads like the web feed", () => {
    expect(timeAgo(ago(10), now)).toBe("now");
    expect(timeAgo(ago(5 * 60), now)).toBe("5m");
    expect(timeAgo(ago(3 * 3600), now)).toBe("3h");
    expect(timeAgo(ago(2 * 86400), now)).toBe("2d");
    expect(timeAgo(ago(30 * 86400), now)).toBe("20 Sept");
  });

  it("is empty for a date it can't read", () => {
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("chat dates", () => {
  const today = new Date(2026, 9, 28, 10, 0);
  it("day lines read Today, Yesterday, then the date", () => {
    expect(dayLabel(new Date(2026, 9, 28, 8, 0).toISOString(), today)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 27, 23, 0).toISOString(), today)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 20, 9, 0).toISOString(), today)).toBe("Tue 20 Oct");
    expect(dayLabel(new Date(2025, 11, 31, 9, 0).toISOString(), today)).toBe("Wed 31 Dec 2025");
  });
  it("times read 4:05 pm", () => {
    expect(clock(new Date(2026, 9, 28, 16, 5).toISOString())).toBe("4:05 pm");
    expect(clock(new Date(2026, 9, 28, 0, 30).toISOString())).toBe("12:30 am");
  });
});
