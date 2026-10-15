/**
 * A home address in the parts onboarding asks for. The area is required: many streets share a name
 * across a city, and it's the area that tells them apart.
 */
export interface AddressParts {
  /** House number and street, e.g. "12 Admiralty Way". */
  street: string;
  /** Neighbourhood, estate or district, e.g. "Lekki Phase 1". */
  area: string;
  city: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  /**
   * "street": the street was found in (or near) the area given. "area": it wasn't, so this is the middle
   * of the area, and the neighbour has to place their home on the map themselves.
   */
  precision: "street" | "area";
}

export interface ReverseGeocodeResult {
  /** The geocoder's full description of the place. */
  address: string;
  /** The same place in onboarding's fields; any part may be "" when the geocoder doesn't know it. */
  parts: AddressParts;
}

export interface GeocodingProvider {
  /** Resolves an address to coordinates, or null if neither the street nor the area can be found. */
  geocode(address: AddressParts): Promise<GeocodeResult | null>;
  /** Resolves coordinates to an address, or null if no match is found. */
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null>;
}
