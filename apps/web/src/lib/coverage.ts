/**
 * Neighbourhoods myHoodora is live in. Mirrors the seed data in
 * apps/api/src/neighborhoods/seeds — planned: GET /neighborhoods/coverage.
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
