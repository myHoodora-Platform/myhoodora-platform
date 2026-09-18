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
        href: "/dashboard/safety-watch",
        icon: Users,
      },
      {
        title: "Community Events",
        href: "/dashboard/events",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        title: "Marketplace Listings",
        href: "/dashboard/marketplace",
        icon: ShoppingBag,
      },
    ],
  },
];

/**
 * Whether a nav item's href should be considered active for the current
 * pathname. "/dashboard" is a literal prefix of every other dashboard route
 * (e.g. "/dashboard/events"), so it must only match exactly — otherwise it
 * would incorrectly show as active on every nested dashboard page.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

/** Resolve the nav item matching the current pathname (exact or nested route). */
export function getActiveNavItem(
  pathname: string,
): DashboardNavItem | undefined {
  for (const section of DASHBOARD_NAV) {
    for (const item of section.items) {
      if (item.href && isNavItemActive(pathname, item.href)) {
        return item;
      }
    }
  }
  return undefined;
}
