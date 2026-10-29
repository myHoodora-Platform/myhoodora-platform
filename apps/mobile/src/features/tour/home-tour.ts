import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { readFirstRun, writeFirstRun } from "@/core/onboarding/first-run";
import { useTour, type TourStep } from "./tour-provider";

/** Lets the feed settle (and the screen finish sliding in) before the tour dims it. */
const START_DELAY_MS = 900;

export const TOUR_TARGETS = {
  filters: "feed-filters",
  topActions: "top-actions",
  post: "post-button",
  forSale: "tab-for-sale",
  menu: "tab-menu",
} as const;

/** The web's home tour (features/tour/first-run-tour.tsx), for the app's layout. */
export function homeTourSteps(hoodName: string | undefined): TourStep[] {
  return [
    {
      target: TOUR_TARGETS.filters,
      title: hoodName ? `Welcome to ${hoodName}` : "Your neighbourhood feed",
      body: "Everything here is from verified neighbours. Use these filters to jump to alerts, events, things for sale or recommendations.",
    },
    {
      target: TOUR_TARGETS.topActions,
      title: "Search, notifications and messages",
      body: "Always at the top, on every tab. Your chats with neighbours and sellers are one tap away.",
    },
    {
      target: TOUR_TARGETS.post,
      title: "Post to your neighbours",
      body: "Ask for a trusted artisan, share an update, raise an alert, plan an event or start a poll.",
    },
    {
      target: TOUR_TARGETS.forSale,
      title: "Buy, sell or give away",
      body: "Find good deals and free things nearby, or list something you no longer need.",
    },
    {
      target: TOUR_TARGETS.menu,
      title: "Everything else is in Menu",
      body: "Alerts with a map of your area, groups, events, saved posts, your listings and settings.",
    },
  ];
}

/**
 * Shows the home tour once, on the feed, to a newcomer who has just joined their neighbourhood (see
 * noteFirstRunEligibility), or to anyone who asked to see it again from Settings. Marked as started
 * when it opens, so leaving halfway doesn't bring it back.
 */
export function useFirstRunTour(uid: string, hoodName: string | undefined, ready: boolean) {
  const { start, running } = useTour();
  const name = useRef(hoodName);
  useEffect(() => {
    name.current = hoodName;
  }, [hoodName]);
  useFocusEffect(
    useCallback(() => {
      if (!ready || running) return;
      let cancelled = false;
      const timer = setTimeout(() => {
        void readFirstRun(uid).then(async (status) => {
          if (cancelled || status !== "pending") return;
          await writeFirstRun(uid, "started");
          start(homeTourSteps(name.current), (how) => void writeFirstRun(uid, how));
        });
      }, START_DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [uid, ready, running, start]),
  );
}

/** Settings → "Take the tour again": it runs the next time the feed is open. */
export const replayHomeTour = (uid: string) => writeFirstRun(uid, "pending");
