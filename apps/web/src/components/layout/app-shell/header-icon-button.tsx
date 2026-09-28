"use client";

import { forwardRef } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

interface HeaderIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  badge?: number;
  href?: string;
}

const base =
  "relative flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden
      className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-coral px-1 text-[11px] font-bold text-white ring-2 ring-card"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Round icon button for the top bar (bell, messages) with an unread badge. */
export const HeaderIconButton = forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  ({ icon: Icon, label, badge, href, className, ...props }, ref) => {
    if (href) {
      return (
        <Link href={href} aria-label={label} className={cn(base, className)}>
          <Icon className="size-5" aria-hidden />
          <Badge count={badge} />
        </Link>
      );
    }
    return (
      <button ref={ref} type="button" aria-label={label} className={cn(base, className)} {...props}>
        <Icon className="size-5" aria-hidden />
        <Badge count={badge} />
      </button>
    );
  },
);
HeaderIconButton.displayName = "HeaderIconButton";
