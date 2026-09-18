import type { LucideIcon } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "primary" | "amber" | "rose" | "slate";
}

const ACCENT_CLASSES: Record<Required<StatTileProps>["accent"], string> = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
};

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "primary",
}: StatTileProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          ACCENT_CLASSES[accent],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {value}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
