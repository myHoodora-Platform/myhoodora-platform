"use client";

import { SidebarTrigger, useSidebar } from "@myhoodora/ui/sidebar";
import { FlaskConical } from "lucide-react";
import { useAdminSession } from "@/features/admin/session";
import { setPreviewRole } from "@/lib/api/admin/session";
import type { AdminRole } from "@/lib/api/admin/types";

/**
 * Slim top bar: menu trigger on small screens and, in preview (mock) mode,
 * a clearly labelled role switch so both staff experiences can be reviewed.
 * Page titles and breadcrumbs live in each page's header.
 */
export function AdminHeader() {
  const { state } = useSidebar();
  const { session, reload } = useAdminSession();
  const isCollapsed = state === "collapsed";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <SidebarTrigger className="lg:hidden" />
      {isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}
      <p className="text-sm font-semibold text-muted-foreground lg:hidden">myHoodora Admin</p>

      {session?.preview && (
        <div className="ml-auto flex items-center gap-2 rounded-full border border-info/30 bg-info-soft/60 py-1 pr-1 pl-3 text-xs font-semibold text-info">
          <FlaskConical className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Preview data · viewing as</span>
          <select
            aria-label="Preview as role"
            value={session.role}
            onChange={(e) => {
              setPreviewRole(e.target.value as AdminRole);
              reload();
            }}
            className="rounded-full border border-info/30 bg-card px-2 py-0.5 text-xs font-bold text-foreground outline-none"
          >
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>
      )}
    </header>
  );
}
