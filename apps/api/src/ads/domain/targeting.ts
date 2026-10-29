import { distanceKm } from "../../shared/geo/distance";

/** Where an ad is aimed: all three empty means every neighbourhood. */
export interface AdAim {
  hoodIds: string[];
  cities: string[];
  near?: { lat: number; lng: number; radiusKm: number; label?: string } | null;
}

/** A neighbourhood as targeting sees it: its id, city and centre (never a neighbour's own location). */
export interface HoodPlace {
  id: string;
  city?: string;
  lat?: number;
  lng?: number;
}

/**
 * Whether an ad reaches neighbours in this neighbourhood: aimed everywhere, at it, at its city, or at a
 * place whose radius covers its centre. One rule for the feed and for opening a promoted seller's items.
 */
export function reaches(ad: AdAim, hood: HoodPlace): boolean {
  if (!ad.hoodIds.length && !ad.cities.length && !ad.near) return true;
  if (ad.hoodIds.includes(hood.id)) return true;
  if (hood.city && ad.cities.includes(hood.city)) return true;
  return !!ad.near && hood.lat !== undefined && hood.lng !== undefined && distanceKm(ad.near, { lat: hood.lat, lng: hood.lng }) <= ad.near.radiusKm;
}

/** Mongo filter: ads switched on, not deleted, and inside their dates now. */
export function liveAdFilter(now: Date) {
  return {
    status: "active" as const,
    deletedAt: null,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }],
  };
}
