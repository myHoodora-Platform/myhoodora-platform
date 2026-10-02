import { BadgeCheck } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { MascotMark } from "@myhoodora/ui/logo";
import type { SupportStatus } from "@/lib/api/support";

export const SUPPORT_NAME = "myHoodora Support";

/** The official account's avatar: the mascot, never a person's photo. */
export function SupportAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/5", className)}>
      <MascotMark size="sm" />
    </span>
  );
}

export function SupportName({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {SUPPORT_NAME}
      <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Official account" />
    </span>
  );
}

/** Status from the neighbour's side ("open" means the team owes a reply). */
const STATUS: Record<SupportStatus, { label: string; className: string }> = {
  open: { label: "Awaiting reply", className: "bg-warning-soft text-foreground" },
  waiting: { label: "Team replied", className: "bg-primary/10 text-primary" },
  resolved: { label: "Resolved", className: "bg-muted text-muted-foreground" },
};

export function SupportStatusChip({ status }: { status: SupportStatus }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", s.className)}>{s.label}</span>;
}
