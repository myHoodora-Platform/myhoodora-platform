import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapsCoGeocodingProvider, partsOf, withoutHouseNumber } from "./maps-co";

// Ikeja's middle, an Allen Avenue in Ikeja (900 m away), and an Allen Avenue across Lagos (about 25 km).
const IKEJA = { lat: "6.6018", lon: "3.3515" };
const ALLEN_IKEJA = { lat: "6.6010", lon: "3.3597" };
const ALLEN_ELSEWHERE = { lat: "6.4300", lon: "3.5200" };

/** Answers each search by its exact query; anything else finds nothing. */
function geocoder(answers: Record<string, { lat: string; lon: string }[]>) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    return Response.json(answers[url.searchParams.get("q") ?? ""] ?? []);
  });
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls.map(([u]) => new URL(String(u)).searchParams.get("q"));
}

const geocode = (street: string, area = "Ikeja", city = "Lagos") => new MapsCoGeocodingProvider().geocode({ street, area, city });

beforeEach(() => {
  process.env.GEOCODE_MAPS_CO_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("takes the street in the area given, not one of the same name elsewhere", async () => {
    // The full address finds nothing (Nominatim's strict chain); the street alone finds both Allen Avenues.
    geocoder({ "Ikeja, Lagos": [IKEJA], "Allen Avenue, Lagos": [ALLEN_ELSEWHERE, ALLEN_IKEJA] });
    expect(await geocode("Allen Avenue")).toEqual({ lat: 6.601, lng: 3.3597, precision: "street" });
  });

  it("when the street is only found elsewhere, gives the middle of the area and says so", async () => {
    geocoder({ "Ikeja, Lagos": [IKEJA], "Allen Avenue, Lagos": [ALLEN_ELSEWHERE] });
    expect(await geocode("Allen Avenue")).toEqual({ lat: 6.6018, lng: 3.3515, precision: "area" });
  });

  it("drops a house number the map data doesn't have", async () => {
    const queries = geocoder({ "Ikeja, Lagos": [IKEJA], "Allen Avenue, Ikeja, Lagos": [ALLEN_IKEJA] });
    expect(await geocode("12 Allen Avenue")).toMatchObject({ precision: "street" });
    expect(queries()).toEqual(["12 Allen Avenue, Ikeja, Lagos", "Ikeja, Lagos", "Allen Avenue, Ikeja, Lagos"]);
  });

  it("stops at the first street match near the area", async () => {
    const queries = geocoder({ "Allen Avenue, Ikeja, Lagos": [ALLEN_IKEJA], "Ikeja, Lagos": [IKEJA] });
    await geocode("Allen Avenue");
    expect(queries()).toEqual(["Allen Avenue, Ikeja, Lagos", "Ikeja, Lagos"]);
  });

  it("finds nothing rather than guess when neither the address nor the area is known", async () => {
    geocoder({ "Allen Avenue, Lagos": [ALLEN_IKEJA] });
    expect(await geocode("Allen Avenue", "Nowhere Estate")).toBeNull();
  });
});

describe("address parts", () => {
  it("reads a reverse-geocoded place into onboarding's fields", () => {
    expect(partsOf({ house_number: "12", road: "Admiralty Way", suburb: "Lekki Phase 1", county: "Eti-Osa", state: "Lagos State" })).toEqual({
      street: "12 Admiralty Way",
      area: "Lekki Phase 1",
      city: "Lagos",
    });
    expect(partsOf({ road: "Awolowo Avenue", neighbourhood: "Old Bodija", city: "Ibadan" })).toEqual({ street: "Awolowo Avenue", area: "Old Bodija", city: "Ibadan" });
  });

  it("strips a leading house number, and keeps a street that is only a number", () => {
    expect(withoutHouseNumber("12 Admiralty Way")).toBe("Admiralty Way");
    expect(withoutHouseNumber("No. 4b, Allen Avenue")).toBe("Allen Avenue");
    expect(withoutHouseNumber("Allen Avenue")).toBe("Allen Avenue");
    expect(withoutHouseNumber("21")).toBe("21");
  });
});
