import { ageFromBirthDate, ageVerdict } from "./age";

describe("ageFromBirthDate", () => {
  // Noon in Lagos on 2 November 2026.
  const today = new Date("2026-11-02T11:00:00Z");

  it("counts whole years, turning a year older on the birthday itself", () => {
    expect(ageFromBirthDate("2008-11-02", today)).toBe(18);
    expect(ageFromBirthDate("2008-11-03", today)).toBe(17);
    expect(ageFromBirthDate("1990-01-15", today)).toBe(36);
  });

  it("goes by the date in Lagos, not on the server", () => {
    // 23:30 UTC on 1 November is already 2 November in Lagos.
    expect(ageFromBirthDate("2008-11-02", new Date("2026-11-01T23:30:00Z"))).toBe(18);
  });

  it("refuses dates that aren't real, are in the future or are implausibly old", () => {
    for (const bad of ["2001-02-30", "2001-13-01", "01-02-2001", "", "2030-01-01", "1890-01-01"]) {
      expect(ageFromBirthDate(bad, today)).toBeNull();
    }
  });

  it("handles 29 February", () => {
    expect(ageFromBirthDate("2008-02-29", today)).toBe(18);
    expect(ageFromBirthDate("2007-02-29", today)).toBeNull();
  });
});

describe("ageVerdict (year first)", () => {
  const today = new Date("2026-11-02T11:00:00Z");

  it("settles most people from the year alone", () => {
    expect(ageVerdict("1995", today)).toBe("adult");
    expect(ageVerdict("2007", today)).toBe("adult");
    expect(ageVerdict("2009", today)).toBe("child");
    expect(ageVerdict("2026", today)).toBe("child");
  });

  it("needs the full date only for the year that turns 18 now", () => {
    expect(ageVerdict("2008", today)).toBe("needs_date");
    expect(ageVerdict("2008-11-02", today)).toBe("adult");
    expect(ageVerdict("2008-11-03", today)).toBe("child");
  });

  it("goes by the year in Lagos: 23:30 UTC on 31 December is already the new year there", () => {
    expect(ageVerdict("2008", new Date("2026-12-31T23:30:00Z"))).toBe("adult");
  });

  it("refuses years in the future or implausibly far back, and bad dates", () => {
    for (const bad of ["2030", "1890", "95", "", "2001-02-30"]) expect(ageVerdict(bad, today)).toBeNull();
  });
});
