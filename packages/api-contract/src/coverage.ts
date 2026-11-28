/**
 * Where myHoodora is live. The source of truth is the live Hoods: `GET /neighborhoods/coverage` (public)
 * lists every open Hood by state and city, leaving out the store reviewers' demo Hoods. The web and the
 * app show that, and fall back to the short list below only when the API can't be reached.
 */

/** `GET /neighborhoods/coverage`: most Hoods first, each state's cities likewise, each city's Hoods by name. */
export interface CoverageResponse {
  total: number;
  states: { state: string | null; hoods: number; cities: { city: string; areas: string[] }[] }[];
}

/** One city and its Hoods, the shape the sign-up screens list. */
export interface CoverageCity {
  city: string;
  state: string | null;
  areas: readonly string[];
}

/**
 * Fallback only, for when the API can't be reached: a few well-known areas per city, not every Hood.
 * Use the live list (`coverageCities`) wherever it's available.
 */
export const COVERAGE = [
  {
    city: "Lagos",
    state: "Lagos",
    areas: ["Ikeja", "Victoria Island", "Ikoyi", "Lekki Phase 1", "Ajah", "Yaba", "Surulere", "Gbagada", "Magodo", "Apapa", "Festac Town", "Ikorodu"],
  },
  {
    city: "Ibadan",
    state: "Oyo",
    areas: ["Bodija", "Dugbe", "Mokola", "Agodi", "Jericho", "Challenge", "Iwo Road", "Eleyele", "Apata", "Ring Road"],
  },
] as const;

/** The number of areas in the fallback list: not how many Hoods are live (that's `CoverageResponse.total`). */
export const COVERAGE_COUNT = COVERAGE.reduce((n, c) => n + c.areas.length, 0);

/** The live answer as a list of cities, most Hoods first. */
export function coverageCities(res: CoverageResponse): CoverageCity[] {
  return res.states
    .flatMap((s) => s.cities.map((c) => ({ city: c.city, state: s.state, areas: c.areas })))
    .sort((a, b) => b.areas.length - a.areas.length || a.city.localeCompare(b.city));
}

/** The states in a list of cities, most Hoods first, each once. */
export function coverageStates(cities: readonly CoverageCity[]): string[] {
  const count = new Map<string, number>();
  for (const c of cities) if (c.state) count.set(c.state, (count.get(c.state) ?? 0) + c.areas.length);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
}

/** "Ikeja · Yaba · Surulere and 12 more": a city's first few Hoods, for a list that stays short. */
export function areaPreview(areas: readonly string[], max = 8): string {
  if (areas.length <= max) return areas.join(" · ");
  return `${areas.slice(0, max).join(" · ")} and ${areas.length - max} more`;
}

/** "Lagos, Oyo and Ogun". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
