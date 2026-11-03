import type { User } from "@firebase/auth";
import type { LocationPreview, VerifyLocationResult } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";
import type { Coords } from "@/core/location/location";

/** Which Hood a point would join, without changing anything (contract §29). */
export function previewLocation(user: User, coords: Coords): Promise<LocationPreview> {
  return apiFetch(user, "/users/me/verify-location/preview", { method: "POST", json: { lat: coords.lat, lng: coords.lng } });
}

/** Saves name and address and marks the account onboarded. Done before verifying, as on the web. */
export function completeOnboarding(user: User, input: { displayName: string; address: string; coords: Coords }): Promise<unknown> {
  return apiFetch(user, "/users/me/onboarding", {
    method: "PATCH",
    json: { displayName: input.displayName, location: { address: input.address, lat: input.coords.lat, lng: input.coords.lng } },
  });
}

/**
 * Verifies the address. `neighborhoodId` is the Hood they confirmed from the preview: the API refuses
 * with 409 (nothing changed) if the point isn't in it, so nobody joins a Hood they didn't see.
 */
export function verifyLocation(user: User, coords: Coords, neighborhoodId?: string): Promise<VerifyLocationResult> {
  return apiFetch(user, "/users/me/verify-location", {
    method: "POST",
    json: { lat: coords.lat, lng: coords.lng, ...(neighborhoodId && { neighborhoodId }) },
  });
}

/** Outside every Hood: ask to join a nearby one. Staff review it (contract §16). */
export function requestHood(user: User, hoodId: string): Promise<unknown> {
  return apiFetch(user, "/users/me/hood-request", { method: "POST", json: { hoodId } });
}
