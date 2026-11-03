"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

export interface ChipItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-card text-foreground/80 hover:bg-muted",
  );

interface FilterChipsProps<T extends string> {
  items: readonly ChipItem<T>[];
  active: T;
  /** Link-based: filters live in the URL so back/forward and sharing work. */
  hrefFor?: (id: T) => string;
  /** Button-based alternative for purely local filters. */
  onSelect?: (id: T) => void;
  label: string;
  className?: string;
}

export function FilterChips<T extends string>({
  items,
  active,
  hrefFor,
  onSelect,
  label,
  className,
}: FilterChipsProps<T>) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]", className)}>
      <ul className="flex gap-2 pb-1">
        {items.map((item) => {
          const isActive = item.id === active;
          const content = (
            <>
              {item.icon && <item.icon className="size-4" aria-hidden />}
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs", isActive ? "bg-background/20" : "bg-muted")}>
                  {item.count}
                </span>
              )}
            </>
          );
          return (
            <li key={item.id}>
              {hrefFor ? (
                <Link
                  href={hrefFor(item.id)}
                  scroll={false}
                  replace
                  aria-current={isActive ? "page" : undefined}
                  className={chipClass(isActive)}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelect?.(item.id)}
                  className={chipClass(isActive)}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
