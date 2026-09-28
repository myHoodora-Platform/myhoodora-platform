"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useComposer } from "@/features/feed/composer-context";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_NAV, isNavActive } from "./navigation";

/** Desktop left nav (≥1024px). Mobile uses MobileTabBar instead. */
export function AppSidebar() {
  const pathname = usePathname();
  const { openComposer } = useComposer();

  return (
    <aside className="sticky top-[72px] hidden max-h-[calc(100dvh-72px)] w-[232px] shrink-0 flex-col self-start overflow-y-auto py-6 lg:flex">
      <nav aria-label="Main">
        <ul className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-4 rounded-xl px-3 text-[17px] transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                    active ? "font-bold text-foreground" : "font-medium text-foreground/80",
                  )}
                >
                  <item.icon
                    className={cn("size-6", active && "fill-primary/15 text-primary")}
                    strokeWidth={active ? 2.4 : 1.8}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => openComposer()}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Plus className="size-5" aria-hidden />
        Post
      </button>

      <div className="mt-6 space-y-1 px-3 text-[15px] font-medium text-foreground/80">
        <Link href={ROUTES.settings} className="block py-1.5 hover:underline">
          Settings
        </Link>
        <Link href={ROUTES.help} className="block py-1.5 hover:underline">
          Help centre
        </Link>
        <Link href={ROUTES.guidelines} className="block py-1.5 hover:underline">
          Community guidelines
        </Link>
      </div>
    </aside>
  );
}
