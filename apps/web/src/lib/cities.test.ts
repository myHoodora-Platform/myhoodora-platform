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
      { city: "Abuja", state: "FCT", center: { lat: 9.0, lng: 7.4 } },
      { city: "Abuja", center: { lat: 9.1, lng: 7.5 } },
      { city: "lagos", center: { lat: 6.4, lng: 3.4 } },
      { city: "Abeokuta", center: { lat: 7.16, lng: 3.35 } },
    ]);
    expect(options.map((o) => o.city)).toEqual(["Abeokuta", "Abuja", "Ibadan", "Lagos"]);
    // A city's state is the one its Hoods give; none yet is null, for the admin to choose.
    expect(options[0]!.state).toBeNull();
    expect(options[1]).toEqual({ city: "Abuja", state: "FCT", lat: 9.05, lng: 7.45 });
    // A default city keeps its own starting point and state.
    expect(options[3]).toEqual({ city: "Lagos", state: "Lagos", lat: 6.5244, lng: 3.3792 });
  });
});
