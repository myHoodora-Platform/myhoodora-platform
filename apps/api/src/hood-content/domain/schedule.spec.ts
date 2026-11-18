import { addDays, atWat, rotationPick, watDate, watHour, weekdayIndex } from "./schedule";

describe("Lagos time", () => {
  it("turns a moment into the Lagos date and hour", () => {
    // 23:30 UTC is already 00:30 the next day in Lagos.
    expect(watDate(new Date("2026-11-17T23:30:00Z"))).toBe("2026-11-18");
    expect(watHour(new Date("2026-11-17T23:30:00Z"))).toBe(0);
    expect(watDate(new Date("2026-11-17T22:59:00Z"))).toBe("2026-11-17");
  });

  it("finds the moment for a Lagos date and time", () => {
    expect(atWat("2026-11-18", "08:00").toISOString()).toBe("2026-11-18T07:00:00.000Z");
    expect(atWat("2026-12-31", "00:00").toISOString()).toBe("2026-12-30T23:00:00.000Z");
  });

  it("counts days and weekdays", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(weekdayIndex("2026-11-16")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-22")).toBe(6); // Sunday
  });
});

describe("rotationPick", () => {
  const daily = Array.from({ length: 60 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`);

  it("lines the weekday themes up: Mondays get Monday items", () => {
    expect(rotationPick(daily, "2026-11-16")).toBe("D01");
    expect(rotationPick(daily, "2026-11-22")).toBe("D07");
    expect(rotationPick(daily, "2026-11-23")).toBe("D08");
  });

  it("goes round the whole weeks (spares are only picked by hand)", () => {
    // 8 whole weeks after the anchor Monday: back to the start.
    expect(rotationPick(daily, "2027-01-11")).toBe("D01");
    expect(rotationPick(daily, "2027-01-10")).toBe("D56");
  });

  it("copes with dates before the anchor and with a short bank", () => {
    expect(rotationPick(daily, "2026-11-15")).toBe("D56");
    expect(rotationPick(["D01", "D02"], "2026-11-20")).toBe("D01");
    expect(rotationPick([], "2026-11-20")).toBeNull();
  });
});
