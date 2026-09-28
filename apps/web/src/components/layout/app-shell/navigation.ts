import {
  AlertTriangle,
  CalendarDays,
  Home,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Other path prefixes that should highlight this item (detail pages). */
  matches?: string[];
}

/** Primary nav — Nextdoor's noun-based sections, adapted (docs/frontend-information-architecture.md). */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: ROUTES.newsFeed, icon: Home, matches: ["/p/"] },
  { label: "For Sale & Free", href: ROUTES.forSale, icon: ShoppingBag },
  { label: "Alerts", href: ROUTES.alerts, icon: AlertTriangle },
  { label: "Events", href: ROUTES.events, icon: CalendarDays },
  { label: "Groups", href: ROUTES.groups, icon: Users, matches: ["/g/"] },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return item.matches?.some((m) => pathname.startsWith(m)) ?? false;
}
