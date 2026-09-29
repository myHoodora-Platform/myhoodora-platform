"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CheckCircle2, Flag, Inbox, Minus, Siren, UserCheck, type LucideIcon } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { REASON_LABEL, timeAgo } from "@/components/admin/format";
import { useAuth } from "@/context/AuthContext";
import { listReports } from "@/lib/api/admin/moderation";
import { getOverview } from "@/lib/api/admin/platform";
import type { AdminOverview, Trend } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

interface AttentionTile {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone: "coral" | "amber" | "teal";
}

function attentionTiles(a: AdminOverview["attention"], canBusiness: boolean): AttentionTile[] {
  const tiles: AttentionTile[] = [
    {
      href: "/admin/moderation",
      icon: Flag,
      label: "Reports to review",
      value: a.openReports,
      detail: a.openReports
        ? `${a.urgentReports} high severity${a.oldestOpenReportAt ? ` · oldest ${timeAgo(a.oldestOpenReportAt)}` : ""}`
        : "Queue is clear",
      tone: "coral",
    },
    { href: "/admin/verification", icon: UserCheck, label: "Waiting for verification", value: a.pendingVerifications, detail: a.pendingVerifications ? "Address checks that need a human" : "No one is stuck", tone: "amber" },
    { href: "/admin/inbox?status=open", icon: Inbox, label: "Unanswered messages", value: a.unansweredInbox, detail: a.unansweredInbox ? "Support, contact form and feedback" : "Inbox zero", tone: "teal" },
    { href: "/admin/alerts?level=urgent", icon: Siren, label: "Live urgent alerts", value: a.liveUrgentAlerts, detail: a.liveUrgentAlerts ? "Showing a red banner right now" : "No urgent alerts", tone: "coral" },
  ];
  if (canBusiness) {
    tiles.splice(2, 0, {
      href: "/admin/businesses",
      icon: Building2,
      label: "Business applications",
      value: a.businessApplications,
      detail: a.businessApplications ? "Awaiting approval" : "Nothing waiting",
      tone: "teal",
    });
  }
  return tiles;
}

const TONE = {
  coral: "bg-brand-coral/10 text-brand-coral",
  amber: "bg-amber-100 text-amber-700",
  teal: "bg-primary/10 text-primary",
};

function TrendCard({ label, trend, unit, lowerIsBetter }: { label: string; trend: Trend; unit?: string; lowerIsBetter?: boolean }) {
  const diff = trend.value - trend.previous;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">
        {trend.value}
        {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      <p className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold", diff === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600")}>
        <Icon className="size-3.5" aria-hidden />
        {diff === 0 ? "Same as last week" : `${Math.abs(Math.round(diff * 10) / 10)}${unit ?? ""} vs last week`}
      </p>
    </div>
  );
}

export function OverviewPage() {
  const { session, can } = useAdminSession();
  const { profile } = useAuth();
  const overview = useAdminQuery(getOverview, "overview");
  const queue = useAdminQuery((u) => listReports(u, { status: "active", pageSize: 4 }), "queue-top");

  const name = (profile?.displayName ?? session?.displayName ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      <AdminPageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} description="Here's what needs attention across myHoodora right now." />

      {/* Needs attention */}
      <section aria-labelledby="attention" className="space-y-3">
        <h2 id="attention" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          Needs attention
        </h2>
        {overview.error && !overview.data ? (
          <AdminProblem error={overview.error} onRetry={overview.refetch} />
        ) : !overview.data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2", can("businesses.review") ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            {attentionTiles(overview.data.attention, can("businesses.review")).map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "group flex flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
                  t.value > 0 ? "border-border" : "border-dashed border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", t.value > 0 ? TONE[t.tone] : "bg-muted text-muted-foreground")}>
                    {t.value > 0 ? <t.icon className="size-4" /> : <CheckCircle2 className="size-4" />}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <p className={cn("mt-3 text-3xl font-bold tracking-tight", t.value === 0 && "text-muted-foreground")}>{t.value}</p>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pulse */}
      {overview.data && (
        <section aria-labelledby="pulse" className="space-y-3">
          <h2 id="pulse" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Last 7 days
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TrendCard label="New neighbours" trend={overview.data.pulse.newNeighbours} />
            <TrendCard label="Posts" trend={overview.data.pulse.posts} />
            <TrendCard label="Active Hoods" trend={overview.data.pulse.activeHoods} />
            <TrendCard label="Median time to resolve a report" trend={overview.data.pulse.medianResolveHours} unit="h" lowerIsBetter />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Top of the moderation queue"
          action={
            <Link href="/admin/moderation" className="text-sm font-semibold text-primary hover:underline">
              Open queue
            </Link>
          }
          padded={false}
        >
          {!queue.data ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : queue.data.items.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nothing to review. Nice work.</p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.data.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/moderation/reports/${encodeURIComponent(r.id)}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/40">
                    <StatusBadge status={r.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium">{r.target.preview}</span>
                      <span className="text-xs text-muted-foreground">
                        {REASON_LABEL[r.reasons[0]!.reason]} · {r.reporterCount} {r.reporterCount === 1 ? "report" : "reports"} · {timeAgo(r.firstReportedAt)}
                      </span>
                    </span>
                    {r.assignee && <StatusBadge status="under_review" label={r.assignee.displayName.split(" ")[0]} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent staff actions"
          action={
            <Link href="/admin/moderation/history" className="text-sm font-semibold text-primary hover:underline">
              Full history
            </Link>
          }
        >
          {!overview.data ? <Skeleton className="h-40 rounded-lg" /> : <Timeline events={overview.data.recentActions.slice(0, 6)} />}
        </Panel>
      </div>
    </div>
  );
}
