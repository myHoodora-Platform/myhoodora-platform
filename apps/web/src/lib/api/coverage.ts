import { COVERAGE, coverageCities, type CoverageCity, type CoverageResponse } from "@myhoodora/api-contract/coverage";
import { API_BASE_URL, USE_MOCKS } from "./config";

export interface LiveCoverage {
  cities: CoverageCity[];
  /** Open Hoods; null when only the fallback list is known. */
  total: number | null;
}

export const FALLBACK_COVERAGE: LiveCoverage = { cities: COVERAGE.map((c) => ({ city: c.city, state: c.state, areas: c.areas })), total: null };

function toLive(res: CoverageResponse): LiveCoverage {
  return { cities: coverageCities(res), total: res.total };
}

/**
 * `GET /neighborhoods/coverage` (public): every open Hood by state and city. The fallback list when the
 * API can't be reached. `revalidate` is for server pages (careers, press): refreshed at most hourly.
 */
export async function getCoverage(revalidate?: number): Promise<LiveCoverage> {
  if (USE_MOCKS) return FALLBACK_COVERAGE;
  try {
    const res = await fetch(`${API_BASE_URL}/neighborhoods/coverage`, {
      signal: AbortSignal.timeout(8_000),
      ...(revalidate !== undefined && { next: { revalidate } }),
    });
    return res.ok ? toLive((await res.json()) as CoverageResponse) : FALLBACK_COVERAGE;
  } catch {
    return FALLBACK_COVERAGE;
  }
}
