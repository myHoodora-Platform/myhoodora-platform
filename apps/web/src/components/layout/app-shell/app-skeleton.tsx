import { Skeleton } from "@myhoodora/ui/skeleton";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PRIMARY_NAV } from "./navigation";

/** Mirrors AppShell 1:1 (header, left nav, feed, rail) so loading causes no layout shift. */
export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-canvas" aria-busy aria-label="Loading myHoodora">
      <div className="h-16 border-b border-border bg-card lg:h-[72px]">
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-3 px-4 lg:px-6">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="mx-auto hidden h-11 w-full max-w-xl rounded-full md:block" />
          <div className="ml-auto flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="size-11 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 lg:px-6">
        <div className="hidden w-[232px] shrink-0 space-y-1 py-6 lg:block">
          {PRIMARY_NAV.map((item) => (
            <div key={item.href} className="flex h-12 items-center gap-4 px-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
          <Skeleton className="mt-5 h-12 w-full rounded-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-4 pt-4 sm:pt-6 xl:max-w-[640px]">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <FeedSkeleton count={2} />
        </div>
        <div className="hidden w-[300px] shrink-0 space-y-4 pt-6 xl:block">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
