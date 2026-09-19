"use client";

import { useAdminData } from "@/context/AdminDataContext";
import { StatTile } from "@/components/admin/stat-tile";
import { VerificationBreakdown } from "@/components/admin/verification-breakdown";
import { Skeleton } from "@myhoodora/ui/skeleton";
import {
  Users,
  MessageSquareWarning,
  Bell,
  MapPin,
  Clock,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminOverviewPage() {
  const {
    users,
    queries,
    notifications,
    activity,
    neighborhoods,
    neighborhoodsLoading,
  } = useAdminData();

  const pendingCount = users.filter(
    (u) => u.verificationStatus === "unverified",
  ).length;
  const openQueriesCount = queries.filter((q) => q.status !== "resolved")
    .length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Total users" value={users.length} icon={Users} />
        <StatTile
          label="Pending verification"
          value={pendingCount}
          icon={Clock}
          accent="amber"
        />
        <StatTile
          label="Open queries"
          value={openQueriesCount}
          icon={MessageSquareWarning}
          accent="rose"
        />
        <StatTile
          label="Notifications sent"
          value={notifications.length}
          icon={Bell}
          accent="slate"
        />
        <StatTile
          label="Neighborhoods"
          value={neighborhoodsLoading ? "…" : neighborhoods.length}
          icon={MapPin}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-tight text-slate-900">
            Verification status
          </h2>
          <VerificationBreakdown users={users} />
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-tight text-slate-900">
            Recent activity
          </h2>
          <ul className="space-y-3">
            {activity.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-slate-700">{a.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(a.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            Neighborhoods
          </h2>
          <span className="text-xs text-muted-foreground">Real data</span>
        </div>
        {neighborhoodsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {neighborhoods.slice(0, 9).map((n) => (
                <div
                  key={n._id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{n.name}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {Math.min(9, neighborhoods.length)} of{" "}
              {neighborhoods.length} seeded neighborhoods.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
