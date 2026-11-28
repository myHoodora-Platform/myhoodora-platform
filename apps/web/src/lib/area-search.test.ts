import { describe, expect, it } from "vitest";
import type { CoverageCity } from "@myhoodora/api-contract/coverage";
import { searchAreas, searchKey, toggleArea } from "./area-search";

const cities: CoverageCity[] = [
  { city: "Lagos", state: "Lagos", areas: ["Ikeja", "Lekki Phase 1", "Ojodu Berger", "Sabo Yaba"] },
  { city: "Ota", state: "Ogun", areas: ["Sango-Ota", "Ota", "Ijoko"] },
  { city: "Oyo", state: "Oyo", areas: ["Sabo Oyo", "Isokun"] },
];
const names = (q: string, state?: string) => searchAreas(cities, q, state).map((h) => h.area);

describe("area search", () => {
  it("ignores case, accents, hyphens and extra spaces", () => {
    expect(searchKey("  Sàngó-Ota ")).toBe("sango ota");
    expect(names("sango ota")).toEqual(["Sango-Ota"]);
    expect(names("LEKKI   phase")).toEqual(["Lekki Phase 1"]);
  });

  it("puts names that start with the query first, then the rest of a matching city", () => {
    expect(names("ota")).toEqual(["Ota", "Sango-Ota", "Ijoko"]);
    expect(names("sabo")).toEqual(["Sabo Oyo", "Sabo Yaba"]);
  });

  it("needs every word to match, and can be kept to one state", () => {
    expect(names("sabo oyo")).toEqual(["Sabo Oyo"]);
    expect(names("sabo", "Lagos")).toEqual(["Sabo Yaba"]);
    expect(names("   ")).toEqual([]);
  });

  it("toggles a choice without going past the limit", () => {
    expect(toggleArea(["Ikeja"], "Ota", 2)).toEqual(["Ikeja", "Ota"]);
    expect(toggleArea(["Ikeja", "Ota"], "Ijoko", 2)).toEqual(["Ikeja", "Ota"]);
    expect(toggleArea(["Ikeja", "Ota"], "Ikeja", 2)).toEqual(["Ota"]);
  });
});
