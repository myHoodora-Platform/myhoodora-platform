// The address rules are shared with the mobile app (packages/api-contract); the pin rules are this page's own.
export { EMPTY_ADDRESS, addressProblem, joinAddress, splitAddress, type AddressParts } from "@myhoodora/api-contract/lookups";

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
