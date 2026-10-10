"use client";

import { hoodsNear } from "@/lib/api/admin/community";
import type { HoodFootprint } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";

/**
 * Every Hood (not archived) a Hood centred at `center` could overlap, except `exceptId`, in any city.
 * Empty until there is a centre. While a new centre loads, the previous Hoods stay on screen.
 */
export function useHoodsAround(center: { lat: number; lng: number } | undefined, exceptId?: string): HoodFootprint[] {
  const { data } = useAdminQuery((u) => (center ? hoodsNear(u, center) : Promise.resolve([])), center ? `hoods-near-${center.lat},${center.lng}` : "hoods-near-none");
  return (data ?? []).filter((h) => h.id !== exceptId);
}
