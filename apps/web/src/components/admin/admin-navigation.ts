import type { ComponentType, SVGProps } from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquareWarning,
  Bell,
  MapPin,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/admin/users", icon: Users },
      { title: "Neighborhoods", href: "/admin/neighborhoods", icon: MapPin },
      { title: "Queries", href: "/admin/queries", icon: MessageSquareWarning },
      { title: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
];

/**
 * Whether a nav item's href should be considered active for the current
 * pathname. "/admin" is a literal prefix of every other admin route (e.g.
 * "/admin/users"), so — same fix as the dashboard nav — it must only match
 * exactly, never via a startsWith prefix check.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return false;
  return pathname.startsWith(`${href}/`);
}

export function getActiveNavItem(pathname: string): AdminNavItem | undefined {
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (isNavItemActive(pathname, item.href)) {
        return item;
      }
    }
  }
  return undefined;
}
