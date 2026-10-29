import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys, getHood, listFeed, nextCursor, pagePosts } from "@/features/feed/feed-api";
import { ALERT_HISTORY_DAYS, isRecentAlert } from "./alert-lifecycle";
import type { HoodArea } from "./place-picker";

const WEEK_MS = ALERT_HISTORY_DAYS * 24 * 3_600_000;

/** The neighbourhood's last week of alerts, shared by the Alerts list and its map (one request). */
export function useRecentAlerts(hoodId: string, now: number) {
  const user = useSignedInUser();
  const query = useInfiniteQuery({
    queryKey: [...feedKeys.hood(hoodId), "alerts-screen"],
    queryFn: ({ pageParam }) => listFeed(user, hoodId, pageParam, "alert"),
    initialPageParam: undefined as string | undefined,
    // Only the last week is shown, so stop once a page reaches past it.
    getNextPageParam: (page) => {
      const last = page[page.length - 1];
      return last && now - new Date(last.createdAt).getTime() < WEEK_MS ? nextCursor(page) : undefined;
    },
  });
  const all = useMemo(() => (query.data?.pages.flatMap(pagePosts) ?? []).filter((p) => isRecentAlert(p, now)), [query.data, now]);
  return { query, all };
}

/** Your neighbourhood's name, centre and radius (the API sends the centre for your own one only). */
export function useHoodArea(hoodId: string | undefined): { area: HoodArea | null; name?: string } {
  const user = useSignedInUser();
  const hood = useQuery({ queryKey: feedKeys.hoodName(hoodId ?? ""), queryFn: () => getHood(user, hoodId!), enabled: !!hoodId, staleTime: Infinity });
  const c = hood.data?.location?.coordinates;
  return {
    name: hood.data?.name,
    area: hood.data && c ? { name: hood.data.name, city: hood.data.city, centre: c, radiusMeters: hood.data.radiusMeters ?? 1500 } : null,
  };
}
