"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@myhoodora/ui/utils";
import { MascotMark, MascotWordmark } from "@myhoodora/ui/logo";
import { Avatar, AvatarFallback } from "@myhoodora/ui/avatar";
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
import { LogOut, ArrowLeftRight } from "lucide-react";
import { ADMIN_NAV, isNavItemActive } from "./admin-navigation";

function navItemClassName(isActive: boolean, isCollapsed: boolean): string {
  return cn(
    "group relative flex w-full items-center rounded-lg text-[13px] font-semibold text-slate-300 transition-colors duration-150 outline-none select-none",
    "hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/20",
    isCollapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
    isActive && "bg-primary/20 text-white hover:bg-primary/20 hover:text-white",
  );
}

export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const userInitial = (profile?.displayName || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <Sidebar className="border-slate-800 bg-slate-900">
      {/* Brand */}
      <SidebarHeader className="h-16 flex-row items-center justify-between border-slate-800 px-4 py-0">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {isCollapsed ? <MascotMark size="sm" /> : <MascotWordmark size="sm" />}
          {!isCollapsed && (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white uppercase">
              Admin
            </span>
          )}
        </div>
        {!isCollapsed && (
          <SidebarTrigger className="hidden text-slate-300 hover:bg-white/10 hover:text-white lg:inline-flex" />
        )}
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {ADMIN_NAV.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  const className = navItemClassName(isActive, isCollapsed);
                  const label = isCollapsed ? item.title : undefined;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <Link
                        href={item.href}
                        title={label}
                        aria-current={isActive ? "page" : undefined}
                        className={className}
                      >
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                          />
                        )}
                        <item.icon className="size-[18px] shrink-0" />
                        {!isCollapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User + logout */}
      <SidebarFooter className="gap-2.5 border-slate-800">
        {!isCollapsed ? (
          <Link
            href="/dashboard"
            title="Back to dashboard"
            className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 transition-colors hover:border-primary/40 hover:bg-slate-800"
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-primary/20 text-sm text-primary">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {profile?.displayName || user?.email}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                Back to dashboard
              </p>
            </div>
            <ArrowLeftRight className="size-4 shrink-0 text-slate-500 transition-colors group-hover:text-primary" />
          </Link>
        ) : (
          <Link
            href="/dashboard"
            title="Back to dashboard"
            className="flex justify-center"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/20 text-sm text-primary">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}

        <button
          type="button"
          title={isCollapsed ? "Log out" : undefined}
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center rounded-lg text-[13px] font-semibold text-slate-400 transition-colors duration-150 outline-none select-none",
            "hover:bg-destructive/20 hover:text-destructive",
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
