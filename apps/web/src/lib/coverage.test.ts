import { describe, expect, it } from "vitest";
import { coverageCities, type CoverageResponse } from "@myhoodora/api-contract/coverage";
import { areaPreview, coverageStates, joinNames } from "./coverage";

const live: CoverageResponse = {
  total: 6,
  states: [
    { state: "Lagos", hoods: 3, cities: [{ city: "Lagos", areas: ["Ikeja", "Yaba", "Ajah"] }] },
    { state: "Ogun", hoods: 3, cities: [{ city: "Abeokuta", areas: ["Ake", "Lafenwa"] }, { city: "Obafemi Owode", areas: ["Mowe"] }] },
  ],
};

describe("coverage", () => {
  it("lists cities with the most Hoods first, each keeping its state", () => {
    expect(coverageCities(live).map((c) => `${c.city}/${c.state}`)).toEqual(["Lagos/Lagos", "Abeokuta/Ogun", "Obafemi Owode/Ogun"]);
  });

  it("names the states once each, most Hoods first, in a sentence", () => {
    expect(joinNames(coverageStates(coverageCities(live)))).toBe("Lagos and Ogun");
    expect(joinNames(["Lagos", "Oyo", "Ogun"])).toBe("Lagos, Oyo and Ogun");
    expect(joinNames(["Lagos"])).toBe("Lagos");
  });

  it("keeps a long city's list short", () => {
    expect(areaPreview(["A", "B", "C"], 2)).toBe("A · B and 1 more");
    expect(areaPreview(["A", "B"], 2)).toBe("A · B");
  });
});
