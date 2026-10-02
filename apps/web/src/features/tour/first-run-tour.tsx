"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { ROUTES } from "@/lib/routes";
import { navTourId } from "./placement";
import { ProductTour, type TourEnd, type TourStep } from "./product-tour";
import { HOME_TOUR_ID, readTourStatus, writeTourStatus } from "./storage";

/** Lets the feed and nav settle (and the page finish its own entrance) before the tour dims it. */
const START_DELAY_MS = 900;

function homeTourSteps(hoodName: string | undefined): TourStep[] {
  return [
    {
      target: "feed-filters",
      title: hoodName ? `Welcome to ${hoodName}` : "Your neighbourhood feed",
      body: "Everything here is from verified neighbours. Use these filters to jump to alerts, events, items for sale or recommendations.",
    },
    {
      target: "composer",
      title: "Post to your neighbours",
      body: "Ask for a trusted artisan, share an update or invite people to an event.",
    },
    {
      target: navTourId(ROUTES.alerts),
      title: "Stay on top of alerts",
      body: "Security, power, flooding and other updates from your area. Urgent ones also show as a banner at the top.",
    },
    {
      target: navTourId(ROUTES.forSale),
      title: "Buy, sell or give away",
      body: "Find good deals and free items nearby, or list something you no longer need.",
    },
  ];
}

/**
 * Shows the home tour once, on the feed, to a neighbour who has just been
 * verified (see noteTourEligibility). Existing members never see it.
 */
export function FirstRunTour() {
  const { user, profile, profileStatus } = useAuth();
  const hood = useNeighbourhood();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "running" | "ended">("idle");
  const uid = user?.uid;

  const eligible =
    !!uid &&
    profileStatus === "ready" &&
    profile?.verificationStatus === "verified" &&
    !!profile.neighborhoodId &&
    pathname === ROUTES.newsFeed;

  // Navigating away mid-tour ends it; it was already recorded as started, so it won't come back.
  if (phase === "running" && !eligible) setPhase("ended");

  useEffect(() => {
    if (phase !== "idle" || !eligible || !uid || readTourStatus(HOME_TOUR_ID, uid) !== "pending") return;
    const timer = setTimeout(() => {
      writeTourStatus(HOME_TOUR_ID, uid, "started");
      setPhase("running");
    }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, eligible, uid]);

  const end = useCallback(
    (how: TourEnd) => {
      if (uid) writeTourStatus(HOME_TOUR_ID, uid, how);
      setPhase("ended");
    },
    [uid],
  );

  if (phase !== "running") return null;
  return <ProductTour label="Getting started" steps={homeTourSteps(hood?.name)} onEnd={end} />;
}
