import { cleanLabel, distanceKm, placeLabel, withinReach } from "../alert-place";

const YABA = { lat: 6.5095, lng: 3.3711 };

describe("alert places", () => {
  it("measures like the API", () => {
    expect(distanceKm(YABA, { lat: 6.6018, lng: 3.3515 })).toBeGreaterThan(10);
    expect(distanceKm(YABA, YABA)).toBe(0);
  });

  it("accepts a pin near the neighbourhood, not across town", () => {
    expect(withinReach(YABA, 1500, { lat: 6.512, lng: 3.372 })).toBe(true);
    expect(withinReach(YABA, 1500, { lat: 6.6018, lng: 3.3515 })).toBe(false);
    // A very large neighbourhood reaches twice its radius.
    expect(withinReach(YABA, 8000, { lat: 6.6018, lng: 3.3515 })).toBe(true);
  });

  it("names the place from the street, else the area", () => {
    expect(placeLabel({ address: "Herbert Macaulay Way, Yaba, Lagos", parts: { street: "Herbert Macaulay Way", area: "Yaba", city: "Lagos" } })).toBe("Herbert Macaulay Way");
    expect(placeLabel({ address: "Yaba, Lagos", parts: { street: "", area: "Yaba", city: "Lagos" } })).toBe("Yaba");
    expect(placeLabel({ address: "Somewhere, Lagos", parts: { street: "", area: "", city: "" } })).toBe("Somewhere");
    expect(placeLabel(null)).toBe("");
  });

  it("tidies what was typed", () => {
    expect(cleanLabel("  Allen   Avenue\nroundabout ")).toBe("Allen Avenue roundabout");
    expect(cleanLabel("x".repeat(200))).toHaveLength(120);
  });
});
