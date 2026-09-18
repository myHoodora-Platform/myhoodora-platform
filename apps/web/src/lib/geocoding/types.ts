export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  /** Resolves a free-text address to coordinates, or null if no match is found. */
  geocode(address: string): Promise<GeocodeResult | null>;
  /** Resolves coordinates to a human-readable address, or null if no match is found. */
  reverseGeocode(lat: number, lng: number): Promise<string | null>;
}
