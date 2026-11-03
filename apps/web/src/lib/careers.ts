/**
 * Open roles shown on /careers. Empty on purpose until real roles are
 * approved — the page then shows the talent network instead of a list.
 * Add a role here and the grouped job list appears automatically.
 */
export interface OpenRole {
  id: string;
  title: string;
  team: "Engineering" | "Product & design" | "Community & trust" | "Growth & partnerships" | "Operations & support";
  location: string; // e.g. "Lagos (hybrid)", "Remote, Nigeria"
  type: "Full-time" | "Part-time" | "Contract" | "Internship";
  /** Where "Apply" goes: an ATS link or mailto. */
  applyUrl: string;
}

export const OPEN_ROLES: OpenRole[] = [];
