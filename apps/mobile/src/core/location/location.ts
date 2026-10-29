import type { User } from "@firebase/auth";
import type { AddressParts, GeocodeResult, ReverseGeocodeResult } from "@myhoodora/api-contract/lookups";
import * as Location from "expo-location";
import { webFetch } from "@/core/api/client";

export interface Coords {
  lat: number;
  lng: number;
}

export type PositionResult =
  | { ok: true; coords: Coords; /** Metres the phone says it may be off by, when it says. */ accuracyM: number | null }
  | { ok: false; reason: PositionProblem };

/**
 * Why there's no position. "denied": the person said no (or did before: iOS only asks once). "off":
 * Location Services are off for the whole phone. "timeout": no fix in time (indoors, weak GPS).
 * "approximate": only a rough area was shared (iOS "Precise Location" off), too rough to find a home.
 */
export type PositionProblem = "denied" | "off" | "timeout" | "unavailable" | "approximate";

/** The web's limit for waiting on GPS (onboarding page). */
export const POSITION_TIMEOUT_MS = 15_000;
/** Past this the fix is a district, not a street: iOS's approximate location is several kilometres. */
export const APPROXIMATE_M = 1_000;

/**
 * The phone's position, asked for only when the person taps "Use my current location" (foreground
 * only). The app never stores it: it is sent to look up the address and the Hood, and saved only as
 * the home they confirm.
 */
export async function currentPosition(): Promise<PositionResult> {
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) return { ok: false, reason: "off" };
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return { ok: false, reason: "denied" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), POSITION_TIMEOUT_MS);
    });
    const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout]);
    if (position === "timeout") return { ok: false, reason: "timeout" };
    const accuracyM = position.coords.accuracy ?? null;
    if (accuracyM !== null && accuracyM > APPROXIMATE_M) return { ok: false, reason: "approximate" };
    return { ok: true, coords: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracyM };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/** What to tell the person, and what they can do instead. */
export const POSITION_PROBLEM: Record<PositionProblem, string> = {
  denied: "Location is off for myHoodora. Type your address below, or allow location for myHoodora in Settings.",
  off: "Location Services are off on this phone. Turn them on in Settings, or type your address below.",
  timeout: "Finding your location took too long. Try again outside or near a window, or type your address below.",
  unavailable: "We couldn't get your location just now. Try again, or type your address below.",
  approximate: "Your phone only shared an approximate location, which can't tell us which street you're on. Turn on Precise Location for myHoodora in Settings, or type your address below.",
};

/**
 * The web server's geocoder (apps/web/src/app/api/geocode), which the mobile app calls with its ID
 * token. 404 means not found; the caller shows that, not an error.
 */
export function geocode(user: User, address: AddressParts): Promise<GeocodeResult> {
  const query = new URLSearchParams({ street: address.street.trim(), area: address.area.trim(), city: address.city.trim() });
  return webFetch<GeocodeResult>(user, `/api/geocode?${query}`);
}

export function reverseGeocode(user: User, coords: Coords): Promise<ReverseGeocodeResult> {
  return webFetch<ReverseGeocodeResult>(user, `/api/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`);
}
