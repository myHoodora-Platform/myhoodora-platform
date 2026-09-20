import type { ReactNode } from "react";
import { cn } from "./utils";

interface DividerProps {
  /** Optional centered label (rendered as a small uppercase caption). */
  label?: ReactNode;
  className?: string;
}

/**
 * Horizontal rule with an optional centered label (the "or" divider used
 * between social auth and the email form). Extracted so the rule, label
 * weight, and spacing stay consistent everywhere it appears.
 */
export function Divider({ label, className }: DividerProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="h-px flex-1 bg-border" />
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
