import { beforeEach, describe, expect, it, vi } from "vitest";
import { AGE_LOCK_MS, ageCheckLocked, lockAgeCheck } from "./age-lock";
import { checkBirthDate, daysInMonth, formatBirthDate, readBirthInput, spokenBirthAnswer } from "@myhoodora/api-contract/age";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, String(v)) };
}

describe("age lock", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("is off until someone is turned away, then on for 30 days", () => {
    expect(ageCheckLocked()).toBe(false);
    lockAgeCheck(1_000);
    expect(ageCheckLocked(1_000 + AGE_LOCK_MS - 1)).toBe(true);
    expect(ageCheckLocked(1_000 + AGE_LOCK_MS)).toBe(false);
  });
});

describe("checkBirthDate (shared with the app)", () => {
  const today = new Date(2026, 10, 2, 12);

  it("says adult from the 18th birthday on, and never names the age in its problems", () => {
    expect(checkBirthDate("2008-11-02", today)).toEqual({ ok: true, adult: true });
    expect(checkBirthDate("2008-11-03", today)).toEqual({ ok: true, adult: false });
    for (const bad of ["2008-02-30", "2027-01-01", "1800-01-01"]) {
      const r = checkBirthDate(bad, today);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem).not.toMatch(/18/);
    }
  });

  it("builds and bounds dates for the pickers", () => {
    expect(formatBirthDate({ year: 2001, month: 4, day: 9 })).toBe("2001-04-09");
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2025)).toBe(28);
    expect(daysInMonth(2)).toBe(29);
  });
});

describe("readBirthInput: year first (shared with the app)", () => {
  const today = new Date(2026, 10, 2, 12);

  it("settles most years alone, and sends only the year", () => {
    expect(readBirthInput({ year: "1995" }, today)).toEqual({ ok: true, value: "1995", adult: true });
    expect(readBirthInput({ year: "2007" }, today)).toEqual({ ok: true, value: "2007", adult: true });
    expect(readBirthInput({ year: "2009" }, today)).toEqual({ ok: true, value: "2009", adult: false });
  });

  it("asks the day and month only for the year that turns 18 now", () => {
    expect(readBirthInput({ year: "2008" }, today).ok).toBe(false);
    expect(readBirthInput({ year: "2008", month: "11", day: "2" }, today)).toEqual({ ok: true, value: "2008-11-02", adult: true });
    expect(readBirthInput({ year: "2008", month: "11", day: "3" }, today)).toEqual({ ok: true, value: "2008-11-03", adult: false });
  });

  it("explains a bad year without naming the minimum age", () => {
    for (const year of ["", "95", "2030", "1800"]) {
      const r = readBirthInput({ year }, today);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem).not.toMatch(/18/);
    }
  });

  it("reads the answer back", () => {
    expect(spokenBirthAnswer("1995")).toBe("1995");
    expect(spokenBirthAnswer("2008-04-09")).toBe("9 April 2008");
  });
});
