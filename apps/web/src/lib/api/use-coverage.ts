"use client";

import { useEffect, useState } from "react";
import { FALLBACK_COVERAGE, getCoverage, type LiveCoverage } from "./coverage";

/** Where we're live, for client screens: the fallback list straight away, the live one once it arrives. */
let pending: Promise<LiveCoverage> | null = null;
export function useCoverage(): LiveCoverage {
  const [coverage, setCoverage] = useState<LiveCoverage>(FALLBACK_COVERAGE);
  useEffect(() => {
    let alive = true;
    pending ??= getCoverage().then((c) => {
      if (c.total === null) pending = null; // Ask again next time.
      return c;
    });
    void pending.then((c) => alive && setCoverage(c));
    return () => {
      alive = false;
    };
  }, []);
  return coverage;
}
