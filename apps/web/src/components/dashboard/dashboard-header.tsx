"use client";

import { useAuth } from "@/context/AuthContext";
import { SidebarTrigger, useSidebar } from "@myhoodora/ui/sidebar";
import { MapPin } from "lucide-react";

interface DashboardHeaderProps {
  /** Page title shown on the left, next to the sidebar trigger. */
  title: string;
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { profile } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile: always visible. Desktop: shown only when the sidebar is collapsed. */}
      <SidebarTrigger className="lg:hidden" />
      {isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}

      <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
        {title}
      </h1>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {profile?.isOnboarded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <MapPin className="size-3" />
            <span className="hidden sm:inline">Verified Local</span>
            <span className="sm:hidden">Verified</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600">
            Pending Verification
          </span>
        )}
      </div>
    </header>
  );
}
