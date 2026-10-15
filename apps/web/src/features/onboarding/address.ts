import type { AddressParts } from "@/lib/geocoding/types";

export type { AddressParts };

export const EMPTY_ADDRESS: AddressParts = { street: "", area: "", city: "" };

/** Where the pin came from. GPS and a pin placed on the map are trusted; a typed address is only as good as its match. */
export type PinSource =
  /** The device's location. */
  | "gps"
  /** The neighbour put it there on the map. */
  | "pin"
  /** The typed street, found in the typed area. */
  | "street"
  /** Only the typed area was found: the pin is in its middle until the neighbour moves it. */
  | "area"
  /** From an earlier attempt, saved on the account. */
  | "saved";

/** Editing the address moves the pin only when the pin came from the address. */
export const pinFollowsAddress = (source: PinSource | null) => source === "street" || source === "area" || source === "saved";

export const joinAddress = ({ street, area, city }: AddressParts) => [street, area, city].map((p) => p.trim()).filter(Boolean).join(", ");

/** A one-line address from before the fields were split: "street, area…, city". Best effort, for prefilling. */
export function splitAddress(line: string): AddressParts {
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { street: parts[0]!, area: parts.slice(1, -1).join(", "), city: parts.at(-1)! };
  return { street: parts[0] ?? "", area: parts[1] ?? "", city: "" };
}

const hasWord = (s: string) => /\p{L}{2,}/u.test(s);

/**
 * What's missing from an address, or null. A street and an area are both required: many streets share
 * a name across a city, and it's the area that says which one is meant.
 */
export function addressProblem({ street, area, city }: AddressParts): string | null {
  if (!street.trim() || !hasWord(street)) return "Add your street name, e.g. “12 Admiralty Way”.";
  if (!area.trim() || !hasWord(area)) return "Add your area or estate, e.g. “Lekki Phase 1”. Many streets share a name, and the area tells us which one is yours.";
  if (area.trim().toLowerCase() === street.trim().toLowerCase()) return "Your area should be the neighbourhood or estate your street is in, not the street again.";
  if (!city.trim() || !hasWord(city)) return "Add your city, e.g. “Lagos”.";
  return null;
}
