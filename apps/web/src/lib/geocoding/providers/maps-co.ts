import type { GeocodeResult, GeocodingProvider } from "../types";

// https://geocode.maps.co — free tier, Nominatim-compatible search API.
// Requires a free API key (sign up at https://geocode.maps.co) set as
// GEOCODE_MAPS_CO_API_KEY.
export class MapsCoGeocodingProvider implements GeocodingProvider {
  async geocode(address: string): Promise<GeocodeResult | null> {
    for (const candidate of buildFallbackQueries(address)) {
      const result = await this.search(candidate);
      if (result) return result;
    }
    return null;
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const apiKey = process.env.GEOCODE_MAPS_CO_API_KEY;
    if (!apiKey) {
      throw new Error("GEOCODE_MAPS_CO_API_KEY is not set");
    }

    const url = new URL("https://geocode.maps.co/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`geocode.maps.co reverse request failed: ${response.status}`);
    }

    const result = await response.json();
    return typeof result?.display_name === "string" ? result.display_name : null;
  }

  private async search(query: string): Promise<GeocodeResult | null> {
    const apiKey = process.env.GEOCODE_MAPS_CO_API_KEY;
    if (!apiKey) {
      throw new Error("GEOCODE_MAPS_CO_API_KEY is not set");
    }

    const url = new URL("https://geocode.maps.co/search");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ng");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`geocode.maps.co request failed: ${response.status}`);
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const [match] = results;
    return { lat: parseFloat(match.lat), lng: parseFloat(match.lon) };
  }
}

// Nominatim-derived geocoders (which geocode.maps.co is built on) match
// comma-separated address components as a strict chain: if any one segment
// doesn't correspond exactly to their indexed data — most often a
// neighborhood/estate name inserted between the street and the city — the
// *entire* query returns zero results instead of falling back to the parts
// that would otherwise match. This builds a small ladder of progressively
// broader queries: the original address first, then variants that drop the
// likely-unreliable middle segment(s) while keeping the most specific
// (street) and most reliable (city/state) ends, then the city/state alone.
function buildFallbackQueries(address: string): string[] {
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates = [address];
  const seen = new Set(candidates);

  const addCandidate = (parts: string[]) => {
    const candidate = parts.join(", ");
    if (parts.length > 0 && !seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  };

  const [street] = segments;
  if (segments.length > 2 && street) {
    // Drop the middle segment(s) — keep the street (first) and the last
    // two segments (typically city, state).
    addCandidate([street, ...segments.slice(-2)]);
    // Keep just the street and the very last segment.
    addCandidate([street, segments[segments.length - 1] as string]);
  }

  if (segments.length > 1) {
    // Drop the street/house-number segment entirely.
    addCandidate(segments.slice(1));
  }

  if (segments.length > 2) {
    // Fall back to the last two segments alone (typically city, state).
    addCandidate(segments.slice(-2));
  }

  return candidates;
}
