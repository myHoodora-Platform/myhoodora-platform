"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * List state (search, filters, tab, page, sort) lives in the URL so every
 * view is shareable, survives reload and works with back/forward.
 */
export function useListParams<K extends string>(defaults: Partial<Record<K | "q" | "page" | "sort", string>> = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback((key: K | "q" | "page" | "sort") => params.get(key) ?? defaults[key] ?? "", [params, defaults]);

  const set = useCallback(
    (patch: Partial<Record<K | "q" | "page" | "sort", string | null>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch) as [string, string | null | undefined][]) {
        if (v === null || v === undefined || v === "" || v === defaults[k as K]) next.delete(k);
        else next.set(k, v);
      }
      // Any filter change (not a page change) goes back to page 1.
      if (!("page" in patch)) next.delete("page");
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, router, pathname, defaults],
  );

  const page = Math.max(1, Number(get("page")) || 1);
  const key = useMemo(() => params.toString(), [params]);

  return { get, set, page, key };
}
