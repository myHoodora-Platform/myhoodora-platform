import { currentSeason, defaultSeasons, lagos } from "./seasons-rules";

describe("festive seasons", () => {
  const [christmas, newYear] = defaultSeasons(2026);
  const all = [christmas!, newYear!];

  it("are on in Lagos time: Christmas 15–26 Dec, New Year 31 Dec 18:00 to 1 Jan", () => {
    expect(christmas!.startsAt.toISOString()).toBe("2026-12-14T23:00:00.000Z");
    expect(newYear!.countdownTo!.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(currentSeason(all, lagos(2026, 12, 20))?.key).toBe("christmas-2026");
    expect(currentSeason(all, lagos(2026, 12, 31, 20))?.key).toBe("new-year-2027");
    expect(currentSeason(all, lagos(2027, 1, 3))).toBeNull();
  });

  it("tells the apps a day ahead, so they switch on at the minute", () => {
    expect(currentSeason(all, lagos(2026, 12, 14, 6))?.key).toBe("christmas-2026");
    expect(currentSeason(all, lagos(2026, 12, 13))).toBeNull();
    expect(currentSeason(all, lagos(2026, 12, 30, 20))?.key).toBe("new-year-2027");
  });

  it("skips switched-off seasons, and the latest-started wins an overlap", () => {
    expect(currentSeason([{ ...christmas!, enabled: false }], lagos(2026, 12, 20))).toBeNull();
    const december = { ...christmas!, key: "december", endsAt: lagos(2027, 1, 5) };
    expect(currentSeason([december, newYear!], lagos(2026, 12, 31, 21))?.key).toBe("new-year-2027");
  });
});
