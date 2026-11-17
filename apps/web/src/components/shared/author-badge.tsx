import { BadgeCheck } from "lucide-react";
import type { AuthorKind } from "@myhoodora/api-contract/types";

/**
 * What sits after an author's name: the official Hood Team label, an organisation's check, or a
 * Staff label for myHoodora moderators and admins. Nothing for neighbours, so a neighbour can never
 * look official (docs/product/hood-activation-plan.md §4).
 */
export function AuthorBadge({ kind, staff }: { kind?: AuthorKind; staff?: boolean }) {
  if (kind === "team") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
        <BadgeCheck className="size-3.5" aria-hidden />
        Official · Hood Team
      </span>
    );
  }
  if (kind === "organisation") return <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Official organisation" />;
  if (staff) {
    return <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Staff</span>;
  }
  return null;
}
