/**
 * Address lookups for onboarding: the web server's /api/geocode and /api/reverse-geocode
 * (apps/web/src/app/api). Browsers call them with the session cookie, the mobile app with its
 * Firebase ID token as a Bearer token.
 */

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

export const EMPTY_ADDRESS: AddressParts = { street: "", area: "", city: "" };

/** One line for the profile, as onboarding saves it. */
export const joinAddress = ({ street, area, city }: AddressParts) => [street, area, city].map((p) => p.trim()).filter(Boolean).join(", ");

/** A one-line address from before the fields were split: "street, area…, city". Best effort, for prefilling. */
export function splitAddress(line: string): AddressParts {
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { street: parts[0]!, area: parts.slice(1, -1).join(", "), city: parts.at(-1)! };
  return { street: parts[0] ?? "", area: parts[1] ?? "", city: "" };
}

const hasWord = (s: string) => /\p{L}{2,}/u.test(s);

/** A field of the address, for showing a problem beside it. */
export type AddressField = keyof AddressParts;

/**
 * What's missing from an address, and which field it's about, or null. A street and an area are both
 * required: many streets share a name across a city, and it's the area that says which one is meant.
 */
export function addressIssue({ street, area, city }: AddressParts): { field: AddressField; message: string } | null {
  if (!street.trim() || !hasWord(street)) return { field: "street", message: "Add your street name, e.g. “12 Admiralty Way”." };
  if (!area.trim() || !hasWord(area))
    return { field: "area", message: "Add your area or estate, e.g. “Lekki Phase 1”. Many streets share a name, and the area tells us which one is yours." };
  if (area.trim().toLowerCase() === street.trim().toLowerCase())
    return { field: "area", message: "Your area should be the neighbourhood or estate your street is in, not the street again." };
  if (!city.trim() || !hasWord(city)) return { field: "city", message: "Add your city, e.g. “Lagos”." };
  return null;
}

/** The same check as one message, or null (the web shows it above the form). */
export function addressProblem(address: AddressParts): string | null {
  return addressIssue(address)?.message ?? null;
}
