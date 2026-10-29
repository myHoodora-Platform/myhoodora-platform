"use client";

import { useEffect, useState } from "react";
import { hoodsNear } from "@/lib/api/admin/community";
import type { HoodFootprint } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";

/**
 * Every Hood (not archived) a Hood centred at `center` could overlap, except `exceptId`, in any city.
 * Empty until there is a centre. While a new centre loads, the previous Hoods stay on screen. The centre
 * has to stay put briefly before it is looked up, so dragging the pin or typing doesn't fetch on every step.
 */
export function useHoodsAround(center: { lat: number; lng: number } | undefined, exceptId?: string): HoodFootprint[] {
  const key = center ? `${center.lat},${center.lng}` : "";
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const t = setTimeout(() => setSettled(key), 250);
    return () => clearTimeout(t);
  }, [key]);
  const { data } = useAdminQuery((u) => {
    if (!settled) return Promise.resolve([]);
    const [lat, lng] = settled.split(",").map(Number);
    return hoodsNear(u, { lat: lat!, lng: lng! });
  }, settled ? `hoods-near-${settled}` : "hoods-near-none");
  return (data ?? []).filter((h) => h.id !== exceptId);
}
