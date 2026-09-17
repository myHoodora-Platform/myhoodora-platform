import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import type { MockUser } from "@/lib/admin/mock-data";

export function VerificationBreakdown({ users }: { users: MockUser[] }) {
  const counts = {
    verified: users.filter((u) => u.verificationStatus === "verified").length,
    unverified: users.filter((u) => u.verificationStatus === "unverified")
      .length,
    banned: users.filter((u) => u.verificationStatus === "banned").length,
  };

  const rows = [
    {
      label: "Verified",
      count: counts.verified,
      colorClass: "bg-emerald-500",
      icon: CheckCircle2,
    },
    {
      label: "Unverified",
      count: counts.unverified,
      colorClass: "bg-amber-500",
      icon: Clock,
    },
    {
      label: "Restricted",
      count: counts.banned,
      colorClass: "bg-rose-500",
      icon: ShieldAlert,
    },
  ];

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <row.icon className="size-3.5" />
              {row.label}
            </span>
            <span className="text-slate-800">{row.count}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className={cn("h-2.5 rounded-r-[4px]", row.colorClass)}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
