import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface KickerProps {
  /** Optional leading icon, rendered at the pill's standard size. */
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

/**
 * Uppercase "eyebrow" pill used at the top of marketing sections.
 *
 * The teal-on-light default matches the shared section kicker; pass
 * `className` to restyle the tint (e.g. white-on-dark in a hero, or the
 * coral trust/safety tint).
 */
export function Kicker({ icon: Icon, children, className }: KickerProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}
