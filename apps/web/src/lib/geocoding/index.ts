import { MapsCoGeocodingProvider } from "./providers/maps-co";

export type { GeocodeResult, GeocodingProvider } from "./types";

// Swap this line to change the active geocoding provider.
export const geocodingProvider = new MapsCoGeocodingProvider();
