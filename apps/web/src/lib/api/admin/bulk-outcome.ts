/** What POST /admin/neighbours/bulk answers: each neighbour is handled on their own. */
export interface BulkNeighbourResult {
  /** How many were changed. */
  updated: number;
  /** One per neighbour, in the order sent. Absent from an API that predates per-neighbour results. */
  results?: { uid: string; ok: boolean; message?: string }[];
}

/**
 * What to tell staff after a bulk action: null when everyone was changed,
 * otherwise who wasn't and why. A batch can now succeed in part, and "done"
 * would hide the neighbours it didn't reach.
 */
export function bulkFailureSummary(outcome: BulkNeighbourResult, nameOf: (uid: string) => string): string | null {
  const failed = (outcome.results ?? []).filter((r) => !r.ok);
  if (!failed.length) return null;
  const shown = failed.slice(0, 3).map((f) => `${nameOf(f.uid)}: ${f.message ?? "couldn't be changed"}`);
  const more = failed.length - shown.length;
  const done = outcome.updated === 0 ? "Nobody was changed." : `${outcome.updated} done, ${failed.length} not.`;
  return `${done} ${shown.join(" · ")}${more > 0 ? ` · and ${more} more` : ""}`;
}
