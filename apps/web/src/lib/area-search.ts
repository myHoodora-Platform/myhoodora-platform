import type { CoverageCity } from "@myhoodora/api-contract/coverage";

export interface AreaHit {
  area: string;
  city: string;
  state: string | null;
}

/** "Sàngó-Ota" → "sango ota": case, accents, hyphens and extra spaces don't matter when searching. */
export function searchKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Hoods matching `query` in their name, city or state, best first: names starting with the query, then
 * names containing it, then the rest of a city or state the query starts. Every word must match somewhere.
 */
export function searchAreas(cities: readonly CoverageCity[], query: string, state?: string | null): AreaHit[] {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const q = words.join(" ");
  const scored: { hit: AreaHit; score: number }[] = [];
  for (const c of cities) {
    if (state && c.state !== state) continue;
    // A city or state counts when a word starts it ("lag" → Lagos), so one letter doesn't match a whole state.
    const place = searchKey(`${c.city} ${c.state ?? ""}`).split(" ");
    for (const area of c.areas) {
      const name = searchKey(area);
      if (!words.every((w) => name.includes(w) || place.some((p) => p.startsWith(w)))) continue;
      const score = name.startsWith(q) || name.split(" ").some((part) => part.startsWith(q)) ? 0 : name.includes(q) ? 1 : 2;
      scored.push({ hit: { area, city: c.city, state: c.state }, score });
    }
  }
  return scored.sort((a, b) => a.score - b.score || a.hit.area.localeCompare(b.hit.area)).map((s) => s.hit);
}

/** Toggle `area` in `chosen`, never past `max`. */
export function toggleArea(chosen: readonly string[], area: string, max: number): string[] {
  if (chosen.includes(area)) return chosen.filter((a) => a !== area);
  return chosen.length >= max ? [...chosen] : [...chosen, area];
}
