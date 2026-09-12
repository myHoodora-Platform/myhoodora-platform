import { Skeleton } from "@myhoodora/ui/skeleton";
import { DASHBOARD_NAV } from "./navigation";

// Deterministic, varied text widths so the nav rows don't all look identical.
const ITEM_WIDTHS = ["w-32", "w-24", "w-28", "w-20"];

/**
 * Loading state that mirrors the real dashboard 1:1 (sidebar header → nav
 * sections → footer, plus header + feed content), so the transition to real
 * content causes no layout shift.
 */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-white lg:flex">
        {/* Brand header (matches SidebarHeader h-16) */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-4 w-9 rounded-md" />
          </div>
          <Skeleton className="size-8 rounded-lg" />
        </div>

        {/* Nav sections (derived from DASHBOARD_NAV) */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-3">
          {DASHBOARD_NAV.map((section, sectionIndex) => (
            <div key={section.label} className="flex flex-col gap-2">
              <Skeleton className="mx-3 h-2.5 w-16 rounded" />
              <div className="flex flex-col gap-1">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-2.5 px-3 py-2"
                  >
                    <Skeleton className="size-[18px] shrink-0 rounded" />
                    <Skeleton
                      className={`h-3.5 rounded ${ITEM_WIDTHS[(sectionIndex + itemIndex) % ITEM_WIDTHS.length]}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: user card + logout (matches SidebarFooter) */}
        <div className="flex flex-col gap-2.5 border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-[18px] shrink-0 rounded" />
            <Skeleton className="h-3.5 w-14 rounded" />
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white/80 px-4 sm:px-6">
          <Skeleton className="size-9 shrink-0 rounded-lg lg:hidden" />
          <Skeleton className="h-5 w-40 rounded" />
          <div className="ml-auto">
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            {/* Quick create post */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Skeleton className="h-4 w-44 rounded" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            {/* Feed posts */}
            {[0, 1].map((i) => (
              <div
                key={i}
                className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
