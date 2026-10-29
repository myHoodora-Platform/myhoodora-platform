import { ALERT_PLACE_LABEL_MAX } from "@myhoodora/api-contract/geo";
import type { AddressParts } from "@myhoodora/api-contract/lookups";
import type { PositionProblem } from "@/core/location/location";

// The rule itself is shared with the web (@myhoodora/api-contract/geo); the API applies the same one.
export { ALERT_PLACE_LABEL_MAX as PLACE_LABEL_MAX, ALERT_PLACE_MAX_KM, alertPlaceInReach as withinReach, cleanPlaceLabel as cleanLabel, distanceKm } from "@myhoodora/api-contract/geo";

/** A short name for where the pin is, from the map's lookup: the street, else the area, else the first part. */
export function placeLabel(found: { address: string; parts: AddressParts } | null | undefined): string {
  if (!found) return "";
  const pick = found.parts.street.trim() || found.parts.area.trim() || found.address.split(",")[0]?.trim() || "";
  return pick.slice(0, ALERT_PLACE_LABEL_MAX);
}

/** Why "Use my location" didn't work, for the place picker (the map and search still do). */
export const LOCATE_PROBLEM: Record<PositionProblem, string> = {
  denied: "myHoodora isn't allowed to use your location. Search for the place or move the map instead.",
  off: "Location is off on this phone. Search for the place or move the map instead.",
  timeout: "Finding your location took too long. Search for the place or move the map instead.",
  unavailable: "We couldn't get your location just now. Search for the place or move the map instead.",
  approximate: "Your phone only shared a rough location. Move the map so the pin is on the spot.",
};
