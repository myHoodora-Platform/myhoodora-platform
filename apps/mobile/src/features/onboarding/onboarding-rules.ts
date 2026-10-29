import { addressIssue, type AddressField, type AddressParts } from "@myhoodora/api-contract/lookups";
import type { LocationPreview } from "@myhoodora/api-contract/types";
import type { CoordsSource } from "@/core/onboarding/onboarding-store";

/** The API's OnboardingDto.displayName bounds (2–60), as the web checks them. */
export const NAME_MIN = 2;
export const NAME_MAX = 60;

export type DetailsField = "name" | AddressField;
export type DetailsErrors = Partial<Record<DetailsField, string>>;

export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Add the name your neighbours know you by.";
  if (trimmed.length < NAME_MIN) return `Your name needs at least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `Please keep your name to ${NAME_MAX} characters or fewer.`;
  return null;
}

/** Every problem with step 1, each beside its own field, or null. */
export function detailsErrors(name: string, address: AddressParts): DetailsErrors | null {
  const errors: DetailsErrors = {};
  const n = nameProblem(name);
  if (n) errors.name = n;
  const a = addressIssue(address);
  if (a) errors[a.field] = a.message;
  return Object.keys(errors).length ? errors : null;
}

/** Editing the address moves the point only when it came from the address. GPS stays: home hasn't moved. */
export const coordsFollowAddress = (source: CoordsSource | null) => source === "street" || source === "area" || source === "saved";

/**
 * A point that is only the middle of the area can't decide a Hood: on the web the neighbour drags it onto
 * their home. The app has no map, so it asks for the phone's location or a street that can be found.
 */
export const needsBetterPoint = (source: CoordsSource | null) => source === "area";

/** GPS this far off may be a neighbour's roof or the next street: worth saying so (the web's limit). */
export const LOOSE_GPS_M = 100;

/** What the confirm step's main button does, given the preview. */
export type ConfirmAction = { kind: "join"; hoodId: string; hoodName: string } | { kind: "continue" } | { kind: "blocked"; reason: string };

export function confirmAction(preview: LocationPreview, source: CoordsSource | null): ConfirmAction {
  if (needsBetterPoint(source)) return { kind: "blocked", reason: "We need your street or your current location first." };
  if (preview.hood && preview.cannotJoin) return { kind: "blocked", reason: preview.cannotJoin };
  if (preview.hood) return { kind: "join", hoodId: preview.hood.id, hoodName: preview.hood.name };
  // Outside every Hood: saving and verifying records it, then nearby Hoods can be asked to join.
  return { kind: "continue" };
}

/** "about 1.2 km away", "about 350 m away": the web's formatDistance (apps/web/src/lib/format.ts). */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `about ${Math.max(50, Math.round(metres / 50) * 50)} m away`;
  return `about ${(metres / 1000).toFixed(1).replace(/\.0$/, "")} km away`;
}

/** "within about 40 m": how far off the phone says its fix may be. */
export function formatAccuracy(metres: number): string {
  return metres < 1000 ? `within about ${Math.max(10, Math.round(metres / 10) * 10)} m` : `within about ${(metres / 1000).toFixed(1)} km`;
}
