import { describe, expect, it } from "vitest";
import {
  cityNameProblem,
  cityOptions,
  matchingCity,
  tidyCityName,
} from "./cities";

describe("city names", () => {
  it("tidies spacing and capitals the way Hoods name cities", () => {
    expect(tidyCityName("  port   harcourt ")).toBe("Port Harcourt");
    expect(tidyCityName("ADO-EKITI")).toBe("Ado-Ekiti");
    expect(tidyCityName("abuja")).toBe("Abuja");
    expect(tidyCityName("Ile-Ife")).toBe("Ile-Ife");
  });

  it("refuses names the API wouldn't take, or that aren't a place name", () => {
    expect(cityNameProblem(" a ")).toMatch(/Enter/);
    expect(cityNameProblem("x".repeat(61))).toMatch(/60 characters/);
    expect(cityNameProblem("Abuja!")).toMatch(/letters/);
    expect(cityNameProblem("Port Harcourt")).toBeNull();
    expect(cityNameProblem("Ado-Ekiti")).toBeNull();
  });

  it("finds the existing city a name means, whatever its capitals or spacing", () => {
    const cities = [{ city: "Lagos" }, { city: "Port Harcourt" }];
    expect(matchingCity("lagos ", cities)).toBe("Lagos");
    expect(matchingCity("port  HARCOURT", cities)).toBe("Port Harcourt");
    expect(matchingCity("Abuja", cities)).toBeNull();
  });
});

describe("city options", () => {
  it("lists the defaults and every city with a Hood, once each, starting at its Hoods' middle", () => {
    const options = cityOptions([
      { city: "Abuja", center: { lat: 9.0, lng: 7.4 } },
      { city: "Abuja", center: { lat: 9.1, lng: 7.5 } },
      { city: "lagos", center: { lat: 6.4, lng: 3.4 } },
    ]);
    expect(options.map((o) => o.city)).toEqual(["Abuja", "Ibadan", "Lagos"]);
    expect(options[0]).toEqual({ city: "Abuja", lat: 9.05, lng: 7.45 });
    // A default city keeps its own starting point.
    expect(options[2]).toEqual({ city: "Lagos", lat: 6.5244, lng: 3.3792 });
  });
});
