import { addDays, computeStreak, lagosDay } from "./streak";

const run = (from: string, n: number, skip: number[] = []) => Array.from({ length: n }, (_, i) => addDays(from, i)).filter((_, i) => !skip.includes(i));

describe("streaks", () => {
  it("counts consecutive Lagos days; today still counts until midnight", () => {
    expect(lagosDay(new Date("2026-11-17T23:30:00Z"))).toBe("2026-11-18");
    expect(computeStreak(run("2026-11-10", 5), "2026-11-14")).toMatchObject({ current: 5, activeToday: true, tier: "bronze", toNextTier: 2 });
    expect(computeStreak(run("2026-11-10", 5), "2026-11-15")).toMatchObject({ current: 5, activeToday: false });
  });

  it("forgives one missed day a week, not two", () => {
    // Mon 16 Nov … missing Wed 18.
    expect(computeStreak(run("2026-11-16", 7, [2]), "2026-11-22").current).toBe(6);
    // Two misses in the same week: broken at the second.
    expect(computeStreak(run("2026-11-16", 7, [2, 4]), "2026-11-22").current).toBe(2);
    // Two days in a row missed: broken.
    expect(computeStreak([...run("2026-11-16", 3), ...run("2026-11-21", 2)], "2026-11-22").current).toBe(2);
  });

  it("silver at 7, gold at 30; after a break the tier steps down for a week, then goes", () => {
    const month = run("2026-10-01", 30);
    expect(computeStreak(month, "2026-10-30")).toMatchObject({ tier: "gold", toNextTier: null, best: 30 });
    expect(computeStreak(month, "2026-11-04")).toMatchObject({ current: 0, tier: "silver", best: 30 });
    expect(computeStreak(month, "2026-11-10")).toMatchObject({ current: 0, tier: null });
    expect(computeStreak(run("2026-11-01", 7), "2026-11-07").tier).toBe("silver");
  });

  it("is empty with no activity", () => {
    expect(computeStreak([], "2026-11-17")).toMatchObject({ current: 0, best: 0, lastDay: null, tier: null, toNextTier: 3 });
  });
});
