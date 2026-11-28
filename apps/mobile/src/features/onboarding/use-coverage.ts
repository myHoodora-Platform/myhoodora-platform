import { useQuery } from "@tanstack/react-query";
import { COVERAGE, coverageCities, type CoverageCity, type CoverageResponse } from "@myhoodora/api-contract/coverage";
import { apiFetchPublic } from "@/core/api/client";

const FALLBACK: CoverageCity[] = COVERAGE.map((c) => ({ city: c.city, state: c.state, areas: c.areas }));

/**
 * Where we're live (`GET /neighborhoods/coverage`, public: sign-up shows it before there's an account),
 * as cities with the most Hoods first. The short built-in list until it arrives, or if it can't.
 */
export function useCoverage(): CoverageCity[] {
  const res = useQuery({
    queryKey: ["coverage"],
    queryFn: () => apiFetchPublic<CoverageResponse>("/neighborhoods/coverage"),
    staleTime: 60 * 60 * 1000,
  });
  return res.data ? coverageCities(res.data) : FALLBACK;
}
