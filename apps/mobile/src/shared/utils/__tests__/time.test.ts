import { timeAgo } from "../time";

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
