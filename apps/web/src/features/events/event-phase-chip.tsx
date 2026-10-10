import { cn } from "@myhoodora/ui/utils";
import { eventPhase } from "./event-time";

const CHIP = {
  today: { label: "Today", className: "bg-primary/10 text-primary" },
  live: { label: "Happening now", className: "bg-success-soft text-success" },
  ended: { label: "Ended", className: "bg-muted text-muted-foreground" },
} as const;

/** "Today" / "Happening now" / "Ended" next to an event's date; nothing for later events. */
export function EventPhaseChip({ eventDate, className }: { eventDate?: string; className?: string }) {
  const phase = eventPhase(eventDate);
  if (phase === "upcoming") return null;
  const chip = CHIP[phase];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold", chip.className, className)}>
      {phase === "live" && <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />}
      {chip.label}
    </span>
  );
}
