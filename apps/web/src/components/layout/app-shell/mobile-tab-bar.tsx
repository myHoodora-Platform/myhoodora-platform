"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  ShoppingBag,
  User,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@myhoodora/ui/sheet";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { useComposer } from "@/features/feed/composer-context";
import { navTourId } from "@/features/tour/placement";
import { ROUTES } from "@/lib/routes";
import { isNavActive, type NavItem } from "./navigation";
import { useLogout } from "./user-menu";

const TABS: NavItem[] = [
  { label: "Home", href: ROUTES.newsFeed, icon: Home, matches: ["/p/"] },
  { label: "For Sale", href: ROUTES.forSale, icon: ShoppingBag },
  { label: "Alerts", href: ROUTES.alerts, icon: AlertTriangle },
];

const tabClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
    active ? "text-primary" : "text-foreground/70",
  );

/** Bottom tab bar (<1024px): Home · For Sale · Post · Alerts · More. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { openComposer } = useComposer();
  const [moreOpen, setMoreOpen] = useState(false);
  const [home, forSale, alerts] = TABS as [NavItem, NavItem, NavItem];

  const tab = (item: NavItem) => {
    const active = isNavActive(pathname, item);
    return (
      <Link href={item.href} aria-current={active ? "page" : undefined} data-tour={navTourId(item.href)} className={tabClass(active)}>
        <item.icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch">
          {tab(home)}
          {tab(forSale)}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => openComposer()}
              aria-label="Create a post"
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          </div>
          {tab(alerts)}
          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreOpen)}>
            <Menu className="size-6" strokeWidth={1.8} aria-hidden />
            More
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const close = () => onOpenChange(false);

  const links = [
    { label: "Events", href: ROUTES.events, icon: CalendarDays },
    { label: "Groups", href: ROUTES.groups, icon: Users },
    { label: "Messages", href: ROUTES.inbox, icon: MessageCircle },
    { label: "Notifications", href: ROUTES.notifications, icon: Bell },
    ...(user ? [{ label: "Your profile", href: ROUTES.profile(user.uid), icon: User }] : []),
    { label: "Settings", href: ROUTES.settings, icon: Settings },
    { label: "Help centre", href: ROUTES.help, icon: HelpCircle },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetTitle>More</SheetTitle>
        <SheetDescription className="sr-only">More places in myHoodora</SheetDescription>
        <nav aria-label="More">
          <ul className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex h-14 items-center gap-3 rounded-xl border border-border px-4 text-[15px] font-semibold hover:bg-muted"
                >
                  <l.icon className="size-5 text-primary" aria-hidden />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => {
            close();
            void handleLogout();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-5" aria-hidden />
          Log out
        </button>
      </SheetContent>
    </Sheet>
  );
}
