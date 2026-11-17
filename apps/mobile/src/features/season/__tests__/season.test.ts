import { countdownParts, nextSeasonChange, seasonIsOn } from "@myhoodora/api-contract/seasons";

const season = { startsAt: "2026-12-14T23:00:00.000Z", endsAt: "2026-12-26T23:00:00.000Z" };
const at = (iso: string) => Date.parse(iso);

describe("festive season timing", () => {
  it("is on between its times only", () => {
    expect(seasonIsOn(season, at("2026-12-14T22:59:59Z"))).toBe(false);
    expect(seasonIsOn(season, at("2026-12-15T10:00:00Z"))).toBe(true);
    expect(seasonIsOn(season, at("2026-12-26T23:00:00Z"))).toBe(false);
    expect(seasonIsOn(null)).toBe(false);
  });

  it("knows how long until it switches on or off", () => {
    expect(nextSeasonChange(season, at("2026-12-14T22:00:00Z"))).toBe(3_600_000);
    expect(nextSeasonChange(season, at("2026-12-26T22:00:00Z"))).toBe(3_600_000);
    expect(nextSeasonChange(season, at("2026-12-27T00:00:00Z"))).toBeNull();
  });

  it("counts down to midnight, then stops", () => {
    expect(countdownParts("2026-12-31T23:00:00.000Z", at("2026-12-31T17:47:51Z"))).toEqual({ hours: 5, minutes: 12, seconds: 9 });
    expect(countdownParts("2026-12-31T23:00:00.000Z", at("2027-01-01T00:00:00Z"))).toBeNull();
    expect(countdownParts(null)).toBeNull();
  });
});
