import { percentages, timeLeft, withVote } from "../polls-api";

it("percentages add up to 100", () => {
  expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
  expect(percentages([2, 1])).toEqual([67, 33]);
  expect(percentages([0, 0])).toEqual([0, 0]);
});

it("moving a vote moves the counts, never below zero", () => {
  const r = { postId: "p", counts: { o1: 2, o2: 1 }, total: 3, myVote: null, closed: false };
  const v = withVote(r, "o2");
  expect(v).toMatchObject({ counts: { o1: 2, o2: 2 }, total: 4, myVote: "o2" });
  expect(withVote(v, "o1")).toMatchObject({ counts: { o1: 3, o2: 1 }, total: 4, myVote: "o1" });
  expect(withVote(v, null)).toMatchObject({ counts: { o1: 2, o2: 1 }, total: 3, myVote: null });
});

it("time left reads plainly", () => {
  const now = Date.parse("2026-10-28T10:00:00Z");
  expect(timeLeft("2026-10-31T10:00:00Z", now)).toBe("3 days left");
  expect(timeLeft("2026-10-31T09:59:00Z", now)).toBe("3 days left");
  expect(timeLeft("2026-10-29T12:00:00Z", now)).toBe("1 day left");
  expect(timeLeft("2026-10-28T15:00:00Z", now)).toBe("5 hours left");
  expect(timeLeft("2026-10-28T10:30:00Z", now)).toBe("Ends soon");
  expect(timeLeft("2026-10-28T09:00:00Z", now)).toBe("Final results");
});
