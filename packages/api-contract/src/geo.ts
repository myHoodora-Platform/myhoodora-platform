/** Distances and the alert-place rule, shared by the web and the app (the API applies the same rule: contract §1). */

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** An alert's pin may be this far from the neighbourhood's centre, or twice its radius if larger. */
export const ALERT_PLACE_MAX_KM = 5;
export const ALERT_PLACE_LABEL_MAX = 120;

/** Whether the API will take an alert's pin here. */
export function alertPlaceInReach(centre: { lat: number; lng: number }, radiusMeters: number | undefined, point: { lat: number; lng: number }): boolean {
  return distanceKm(centre, point) <= Math.max(ALERT_PLACE_MAX_KM, ((radiusMeters ?? 0) / 1000) * 2);
}

/** Tidied for sending: one line, no doubled spaces, within the limit. */
export const cleanPlaceLabel = (label: string) => label.replace(/\s+/g, " ").trim().slice(0, ALERT_PLACE_LABEL_MAX);
