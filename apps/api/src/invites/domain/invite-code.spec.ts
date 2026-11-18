import { CHALLENGE_STARTED_AT, CODE_ALPHABET, canStillClaim, firstName, makeInviteCode, normaliseCode, shortName } from "./invite-code";

describe("invite codes", () => {
  it("starts with the name and ends with characters nobody misreads", () => {
    expect(makeInviteCode("Adaeze Okafor", 2, () => 0)).toBe("ADA22");
    expect(makeInviteCode("Tolu", 2, () => 0.999)).toMatch(/^TQK[A-Z0-9]{2}$/); // no O, L
    expect(makeInviteCode("Émeka", 3, () => 0.5)).toMatch(/^EME.{3}$/);
    expect(makeInviteCode("", 2, () => 0)).toBe("NNN22");
    expect(makeInviteCode("李", 2, () => 0)).toBe("NNN22");
    for (let i = 0; i < 200; i++) expect(makeInviteCode("Bisi", 3).slice(3).split("").every((c) => CODE_ALPHABET.includes(c))).toBe(true);
  });

  it("reads codes however they were typed", () => {
    expect(normaliseCode(" ada-7k ")).toBe("ADA7K");
    expect(normaliseCode("ADA 7K")).toBe("ADA7K");
    expect(normaliseCode("ab")).toBeNull();
    expect(normaliseCode("<script>")).toBeNull();
    expect(normaliseCode(42)).toBeNull();
  });

  it("lets people who joined since the challenge started say who invited them, for 30 days", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(canStillClaim(new Date("2026-11-17T08:00:00Z"), now)).toBe(true);
    expect(canStillClaim(new Date("2026-11-10T08:00:00Z"), now)).toBe(false);
    expect(canStillClaim(CHALLENGE_STARTED_AT, new Date("2026-12-18T00:00:00Z"))).toBe(false);
    expect(canStillClaim(undefined, now)).toBe(true);
  });

  it("shows inviters short names only", () => {
    expect(shortName("Adaeze Okafor")).toBe("Adaeze O.");
    expect(shortName("tunde")).toBe("tunde");
    expect(shortName("  ")).toBe("A neighbour");
    expect(firstName("Adaeze Okafor")).toBe("Adaeze");
  });
});
