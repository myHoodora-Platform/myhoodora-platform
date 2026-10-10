import { distanceMeters } from "@/lib/geo";

/** The largest Hood the API allows. */
export const MAX_HOOD_RADIUS_METERS = 20_000;

export interface HoodCircle {
  name: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

/**
 * Where a Hood circle would sit among the others (docs/api-contract.md §28). Hoods may overlap, but
 * not over another Hood's centre. `others` should exclude archived Hoods and the Hood itself.
 */
export function hoodPlacement(circle: HoodCircle, others: HoodCircle[]) {
  const near = others.map((o) => ({ hood: o, d: distanceMeters(circle.center, o.center) }));
  return {
    /** Hoods this centre is inside: refused. */
    inside: near.filter((o) => o.d < o.hood.radiusMeters).map((o) => o.hood),
    /** Hoods whose centre this radius would cover: refused. */
    covers: near.filter((o) => o.d < circle.radiusMeters).map((o) => o.hood),
    /** Hoods this circle overlaps: allowed, and the shared ground is split between them. */
    sharesWith: near.filter((o) => o.d < o.hood.radiusMeters + circle.radiusMeters).map((o) => o.hood),
  };
}

const names = (hoods: HoodCircle[]) => hoods.map((h) => h.name).join(", ");

/** The API's 409 messages, for a new Hood. Null when the placement is allowed. */
export function createProblem(p: ReturnType<typeof hoodPlacement>): string | null {
  if (p.inside.length) return `This centre is inside ${names(p.inside)}. Hoods can overlap, but not over another Hood's centre: move it.`;
  if (p.covers.length) return `This radius would cover the centre of ${names(p.covers)}. Hoods can overlap, but not over another Hood's centre: shrink it or move the centre.`;
  return null;
}

/** The API's 409 message when growing a Hood. Null when the new radius is allowed. */
export function resizeProblem(p: ReturnType<typeof hoodPlacement>): string | null {
  return p.covers.length ? `That radius would cover the centre of ${names(p.covers)}. Hoods can overlap, but not over another Hood's centre: choose a smaller one.` : null;
}
