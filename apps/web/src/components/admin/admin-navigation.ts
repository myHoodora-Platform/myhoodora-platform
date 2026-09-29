import type { ComponentType, SVGProps } from "react";
import {
  BarChart3,
  Building2,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  MapPin,
  Megaphone,
  ShoppingBag,
  Siren,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  Users,
  UsersRound,
  Flag,
} from "lucide-react";
import type { AdminOverview, Capability } from "@/lib/api/admin/types";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hidden unless the viewer's role has this capability. */
  capability?: Capability;
  /** Count of open work shown as a badge. */
  badge?: keyof AdminOverview["attention"];
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

/** Information architecture — docs/admin/ADMIN_TARGET_ARCHITECTURE.md §3. */
export const ADMIN_NAV: AdminNavSection[] = [
  { label: "", items: [{ title: "Overview", href: "/admin", icon: LayoutDashboard }] },
  {
    label: "Moderation",
    items: [
      { title: "Queue", href: "/admin/moderation", icon: Flag, badge: "openReports" },
      { title: "History", href: "/admin/moderation/history", icon: History },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Hoods", href: "/admin/hoods", icon: MapPin },
      { title: "Neighbours", href: "/admin/neighbours", icon: Users },
      { title: "Verification", href: "/admin/verification", icon: UserCheck, badge: "pendingVerifications" },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Posts", href: "/admin/posts", icon: FileText },
      { title: "Safety alerts", href: "/admin/alerts", icon: Siren, badge: "liveUrgentAlerts" },
      { title: "Groups", href: "/admin/groups", icon: UsersRound },
      { title: "Marketplace", href: "/admin/marketplace", icon: ShoppingBag },
    ],
  },
  {
    label: "Businesses",
    items: [{ title: "Businesses", href: "/admin/businesses", icon: Building2, badge: "businessApplications", capability: "businesses.review" }],
  },
  {
    label: "Support",
    items: [
      { title: "Inbox", href: "/admin/inbox", icon: Inbox, badge: "unansweredInbox" },
      { title: "Broadcasts", href: "/admin/broadcasts", icon: Megaphone, capability: "broadcasts.send" },
    ],
  },
  { label: "Insights", items: [{ title: "Insights", href: "/admin/insights", icon: BarChart3 }] },
  {
    label: "Settings",
    items: [
      { title: "Team & roles", href: "/admin/settings/team", icon: UserCog, capability: "team.manage" },
      { title: "Platform", href: "/admin/settings/platform", icon: SlidersHorizontal, capability: "settings.manage" },
    ],
  },
];

/**
 * "/admin" is a prefix of every admin route, so it only matches exactly.
 * "/admin/moderation" must not stay active on "/admin/moderation/history".
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return false;
  if (href === "/admin/moderation") return pathname.startsWith("/admin/moderation/reports");
  return pathname.startsWith(`${href}/`);
}

