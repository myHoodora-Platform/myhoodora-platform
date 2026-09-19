"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@myhoodora/ui/utils";
import { LogoMark, LogoFull } from "@myhoodora/ui/logo";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@myhoodora/ui/sidebar";
import { Avatar, AvatarFallback } from "@myhoodora/ui/avatar";
import { LogOut, ChevronRight } from "lucide-react";
import { DASHBOARD_NAV, isNavItemActive } from "./navigation";

function navItemClassName(isActive: boolean, isCollapsed: boolean): string {
  return cn(
    "group relative flex w-full items-center rounded-lg text-[13px] font-semibold text-slate-600 transition-colors duration-150 outline-none select-none",
    "hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-ring/40",
    isCollapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
    isActive &&
      "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
  );
}

interface DashboardSidebarProps {
  /** Called when a gated (non-routed) nav item succeeds, to surface a message. */
  onNavAction?: (message: string) => void;
}

export function DashboardSidebar({ onNavAction }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, runGatedAction, logout } = useAuth();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  // On mobile the sidebar is an overlay drawer — any navigation or action
  // taken from it should dismiss it, same as tapping the backdrop does.
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const userInitial = (profile?.displayName || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  const handleLogout = async () => {
    closeMobileSidebar();
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <Sidebar>
      {/* Brand */}
      <SidebarHeader className="h-16 flex-row items-center justify-between px-4 py-0">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {isCollapsed ? <LogoMark size="sm" /> : <LogoFull size="sm" />}
          {!isCollapsed && (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-primary">
              V0.1
            </span>
          )}
        </div>
        {!isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {DASHBOARD_NAV.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = Boolean(
                    item.href && isNavItemActive(pathname, item.href),
                  );
                  const className = navItemClassName(isActive, isCollapsed);
                  const label = isCollapsed ? item.title : undefined;

                  if (item.href) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Link
                          href={item.href}
                          title={label}
                          aria-current={isActive ? "page" : undefined}
                          className={className}
                          onClick={closeMobileSidebar}
                        >
                          {isActive && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                            />
                          )}
                          <item.icon className="size-[18px] shrink-0" />
                          {!isCollapsed && (
                            <span className="truncate">{item.title}</span>
                          )}
                        </Link>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <button
                        type="button"
                        title={label}
                        className={className}
                        onClick={() => {
                          closeMobileSidebar();
                          runGatedAction(() => {
                            if (item.successText)
                              onNavAction?.(item.successText);
                          });
                        }}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        {!isCollapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </button>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User + logout */}
      <SidebarFooter className="gap-2.5">
        {!isCollapsed ? (
          <Link
            href="/dashboard/settings"
            title="Profile & settings"
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition-colors hover:border-primary/20 hover:bg-primary/5"
            onClick={closeMobileSidebar}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-sm">{userInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {profile?.displayName || user?.email}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {profile?.isOnboarded
                  ? profile.location?.address
                  : "Onboarding skipped"}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary" />
          </Link>
        ) : (
          <Link
            href="/dashboard/settings"
            title="Profile & settings"
            className="flex justify-center"
            onClick={closeMobileSidebar}
          >
            <Avatar className="size-9">
              <AvatarFallback className="text-sm">{userInitial}</AvatarFallback>
            </Avatar>
          </Link>
        )}

        <button
          type="button"
          title={isCollapsed ? "Log out" : undefined}
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center rounded-lg text-[13px] font-semibold text-muted-foreground transition-colors duration-150 outline-none select-none",
            "hover:bg-destructive/10 hover:text-destructive",
            isCollapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
          )}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!isCollapsed && <span>Log out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
