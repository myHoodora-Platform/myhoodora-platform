import type { ComponentType, SVGProps } from "react";
import {
  MessageSquare,
  Users,
  Calendar,
  ShoppingBag,
} from "lucide-react";

export interface DashboardNavItem {
  /** Display label shown in the sidebar. */
  title: string;
  /** Real route. When set, the item renders as a link and derives active state from the pathname. */
  href?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Items without an `href` are placeholders for upcoming features. When
   * clicked they run through the onboarding-gated action flow and surface a
   * success message (see DashboardSidebar).
   */
  gatedAction?: string;
  successText?: string;
}

export interface DashboardNavSection {
  label: string;
  items: DashboardNavItem[];
}

export const DASHBOARD_NAV: DashboardNavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Neighborhood Feed",
        href: "/dashboard",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        title: "Safety Watch Group",
        icon: Users,
        gatedAction: "Safety Watch Group",
        successText: "Group joined",
      },
      {
        title: "Community Events",
        icon: Calendar,
        gatedAction: "Community Events",
        successText: "Event RSVPed",
      },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        title: "Marketplace Listings",
        icon: ShoppingBag,
        gatedAction: "Marketplace Listings",
        successText: "Listing created",
      },
    ],
  },
];

/** Resolve the nav item matching the current pathname (exact or nested route). */
export function getActiveNavItem(
  pathname: string,
): DashboardNavItem | undefined {
  for (const section of DASHBOARD_NAV) {
    for (const item of section.items) {
      if (
        item.href &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`))
      ) {
        return item;
      }
    }
  }
  return undefined;
}
