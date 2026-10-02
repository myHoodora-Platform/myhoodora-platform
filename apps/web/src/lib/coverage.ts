/**
 * Neighbourhoods myHoodora is live in. Mirrors the seed data in
 * apps/api/src/hoods/seeds, and is kept in step with it by hand (the marketing pages
 * that use it are static). Update both when a city or area launches.
 */
export const COVERAGE = [
  {
    city: "Lagos",
    areas: ["Ikeja", "Victoria Island", "Ikoyi", "Lekki Phase 1", "Ajah", "Yaba", "Surulere", "Gbagada", "Magodo", "Apapa", "Festac Town", "Ikorodu"],
  },
  {
    city: "Ibadan",
    areas: ["Bodija", "Dugbe", "Mokola", "Agodi", "Jericho", "Challenge", "Iwo Road", "Eleyele", "Apata", "Ring Road"],
  },
] as const;

export const COVERAGE_COUNT = COVERAGE.reduce((n, c) => n + c.areas.length, 0);
