import { distanceMeters } from "@/lib/geo";
import type { AddressParts, GeocodeResult, GeocodingProvider, ReverseGeocodeResult } from "../types";

// https://geocode.maps.co — free tier, Nominatim-compatible search API.
// Requires a free API key (sign up at https://geocode.maps.co) set as
// GEOCODE_MAPS_CO_API_KEY.

/** Per request to the geocoder. Without one, a stalled connection holds the route (and the visitor) indefinitely. */
const REQUEST_TIMEOUT_MS = 8_000;
/** The free tier allows one request a second; a lookup makes up to four, one after another. */
const RATE_LIMIT_WAIT_MS = 1_100;
/**
 * How far from the middle of the area a street match may be. Further than this, it's taken to be a
 * street of the same name somewhere else, the mix-up that put neighbours in the wrong Hood.
 */
export const STREET_NEAR_AREA_M = 3_000;

type Point = { lat: number; lng: number };

export class MapsCoGeocodingProvider implements GeocodingProvider {
  /**
   * The street, but only where it's in (or close to) the area given. Nominatim matches comma-separated
   * parts as a strict chain, so a street it knows inside an area it names differently finds nothing;
   * hence the second try without the area, kept only when the match is near the area. Never the city
   * alone, nor a street from elsewhere: when the street can't be placed, the middle of the area, marked
   * so the neighbour places their home on the map.
   */
  async geocode({ street, area, city }: AddressParts): Promise<GeocodeResult | null> {
    const road = withoutHouseNumber(street);
    const full = await this.search(`${street}, ${area}, ${city}`);
    const areaPoint = (await this.search(`${area}, ${city}`, 1))[0];
    if (!areaPoint) return full[0] ? { ...full[0], precision: "street" } : null;

    const queries = [...new Set([`${road}, ${area}, ${city}`, `${road}, ${city}`])].filter((q) => q !== `${street}, ${area}, ${city}`);
    let match = nearest(full, areaPoint);
    for (const query of queries) {
      if (match) break;
      match = nearest(await this.search(query), areaPoint);
    }
    return match ? { ...match, precision: "street" } : { ...areaPoint, precision: "area" };
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    const url = this.url("reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    const result = await this.get(url);
    if (typeof result?.display_name !== "string") return null;
    return { address: result.display_name, parts: partsOf(result.address ?? {}) };
  }

  private async search(query: string, limit = 5): Promise<Point[]> {
    const url = this.url("search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", "ng");
    const results = await this.get(url);
    if (!Array.isArray(results)) return [];
    return results.map((r: { lat: string; lon: string }) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  private url(path: "search" | "reverse") {
    const apiKey = process.env.GEOCODE_MAPS_CO_API_KEY;
    if (!apiKey) throw new Error("GEOCODE_MAPS_CO_API_KEY is not set");
    const url = new URL(`https://geocode.maps.co/${path}`);
    url.searchParams.set("api_key", apiKey);
    return url;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the geocoder's JSON, checked by each caller
  private async get(url: URL): Promise<any> {
    let response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    }
    if (!response.ok) throw new Error(`geocode.maps.co ${url.pathname} request failed: ${response.status}`);
    return response.json();
  }
}

/** The candidate closest to the area's middle, if any is within STREET_NEAR_AREA_M of it. */
function nearest(candidates: Point[], area: Point): Point | undefined {
  return candidates
    .map((c) => ({ c, d: distanceMeters(c, area) }))
    .filter((x) => x.d <= STREET_NEAR_AREA_M)
    .sort((a, b) => a.d - b.d)[0]?.c;
}

/** "12 Admiralty Way" → "Admiralty Way": house numbers are rarely in the map data, and can make a street unfindable. */
export function withoutHouseNumber(street: string): string {
  return street.replace(/^\s*(no\.?\s*)?\d+[a-z]?\b[\s,]*/i, "").trim() || street.trim();
}

/** A Nominatim `address` object in onboarding's fields. */
export function partsOf(a: Record<string, string | undefined>): AddressParts {
  return {
    street: [a.house_number, a.road].filter(Boolean).join(" "),
    area: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.residential ?? "",
    city: a.city ?? a.town ?? a.village ?? a.state?.replace(/\s+State$/i, "") ?? "",
  };
}
