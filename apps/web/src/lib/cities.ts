/**
 * Cities, as Hoods name them. There is no city record: a city exists once a Hood in it does, and
 * everything that works by city (coverage, ad and prompt targeting, Hood content's local versions)
 * compares this name exactly. So a new city's name is tidied before its first Hood is created, and a
 * name that matches an existing city in all but capitals or spacing becomes that city.
 */

export type CityOption = { city: string; lat: number; lng: number };

/** Where a Hood in these cities starts on the map. Other cities start at their Hoods' middle. */
export const DEFAULT_CITIES: CityOption[] = [
  { city: "Lagos", lat: 6.5244, lng: 3.3792 },
  { city: "Ibadan", lat: 7.3775, lng: 3.947 },
];

/** The API's limits on a Hood's city. */
export const CITY_NAME_MIN = 2;
export const CITY_NAME_MAX = 60;

const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * "port   harcourt" → "Port Harcourt", "ADO-EKITI" → "Ado-Ekiti". Words after a space, hyphen or
 * apostrophe start with a capital; a name typed in mixed case ("McCarthy") keeps its capitals.
 */
export function tidyCityName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  const mixed = name !== name.toLowerCase() && name !== name.toUpperCase();
  return name
    .split(/([ '-])/)
    .map((part) =>
      /^[ '-]$/.test(part) || !part
        ? part
        : mixed
          ? part[0]!.toUpperCase() + part.slice(1)
          : part[0]!.toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}

/** Why a new city's name can't be used, or null. */
export function cityNameProblem(input: string): string | null {
  const name = tidyCityName(input);
  if (name.length < CITY_NAME_MIN) return "Enter the city's name.";
  if (name.length > CITY_NAME_MAX)
    return `Keep the city's name to ${CITY_NAME_MAX} characters.`;
  if (!/^[\p{L}][\p{L} '.-]*$/u.test(name))
    return "Use letters, spaces, hyphens and apostrophes only.";
  return null;
}

/** The existing city this name means, ignoring capitals and spacing, if any. */
export function matchingCity(
  input: string,
  cities: Pick<CityOption, "city">[],
): string | null {
  return cities.find((c) => key(c.city) === key(input))?.city ?? null;
}

/**
 * The cities a new Hood can go in: the defaults and every city that has a Hood, by name, each with a
 * starting point for the map (the default one, or the middle of that city's Hoods).
 */
export function cityOptions(
  hoods: { city: string; center: { lat: number; lng: number } }[],
): CityOption[] {
  const byKey = new Map<
    string,
    { city: string; lat: number; lng: number; n: number }
  >();
  for (const h of hoods) {
    const k = key(h.city);
    if (!k) continue;
    const c = byKey.get(k) ?? { city: h.city.trim(), lat: 0, lng: 0, n: 0 };
    c.lat += h.center.lat;
    c.lng += h.center.lng;
    c.n += 1;
    byKey.set(k, c);
  }
  const options = new Map<string, CityOption>();
  for (const d of DEFAULT_CITIES) options.set(key(d.city), d);
  for (const [k, c] of byKey) {
    if (!options.has(k))
      options.set(k, {
        city: c.city,
        lat: Number((c.lat / c.n).toFixed(5)),
        lng: Number((c.lng / c.n).toFixed(5)),
      });
  }
  return [...options.values()].sort((a, b) => a.city.localeCompare(b.city));
}
