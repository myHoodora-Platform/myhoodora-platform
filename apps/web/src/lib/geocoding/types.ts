import type { AddressParts, GeocodeResult, ReverseGeocodeResult } from "@myhoodora/api-contract/lookups";

// The result shapes are shared with the mobile app, which calls the same routes.
export type { AddressParts, GeocodeResult, ReverseGeocodeResult };

export interface GeocodingProvider {
  /** Resolves an address to coordinates, or null if neither the street nor the area can be found. */
  geocode(address: AddressParts): Promise<GeocodeResult | null>;
  /** Resolves coordinates to an address, or null if no match is found. */
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null>;
}
