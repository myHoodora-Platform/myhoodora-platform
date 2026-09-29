"use client";

import { Skeleton } from "@myhoodora/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { REASON_LABEL } from "@/components/admin/format";
import { getInsights } from "@/lib/api/admin/platform";
import { useAdminQuery } from "../use-admin-query";

function Bars({ rows, unit }: { rows: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-muted-foreground">
            {r.value.toLocaleString()}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function InsightsPage() {
  const insights = useAdminQuery(getInsights, "insights");

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Insights" description="How myHoodora is growing and how well we're keeping it safe. Last 30 days." />
      {insights.error && !insights.data ? (
        <AdminProblem error={insights.error} onRetry={insights.refetch} />
      ) : !insights.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        (() => {
          const d = insights.data;
          const maxDay = Math.max(1, ...d.signups.map((s) => s.count));
          const total = d.signups.reduce((n, s) => n + s.count, 0);
          const pct = d.verifiedFunnel.started ? Math.round((d.verifiedFunnel.verified / d.verifiedFunnel.started) * 100) : 0;
          return (
            <>
              <Panel title="New neighbours per day" action={<span className="text-sm font-semibold">{total.toLocaleString()} in 30 days</span>}>
                <div className="flex h-40 items-end gap-1" role="img" aria-label={`Sign-ups per day, ${total} in total`}>
                  {d.signups.map((s) => (
                    <div key={s.day} className="group relative flex-1">
                      <div className="rounded-t bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(4, (s.count / maxDay) * 150)}px` }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] whitespace-nowrap text-background group-hover:block">
                        {s.day.slice(5)}: {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Verification" action={<span className="text-sm font-semibold text-emerald-600">{pct}% verified</span>}>
                  <Bars
                    rows={[
                      { label: "Signed up", value: d.verifiedFunnel.started },
                      { label: "Verified", value: d.verifiedFunnel.verified },
                      { label: "Had a failed check", value: d.verifiedFunnel.failed },
                    ]}
                  />
                </Panel>
                <Panel title="Most active Hoods (posts, 7 days)">
                  <Bars rows={d.activeByHood.map((h) => ({ label: h.hood, value: h.posts7d }))} />
                </Panel>
                <Panel title="Reports by reason">
                  {d.reportsByReason.length ? (
                    <Bars rows={d.reportsByReason.map((r) => ({ label: REASON_LABEL[r.reason] ?? r.reason, value: r.count }))} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No reports in this period.</p>
                  )}
                </Panel>
                <Panel title="Safety">
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">Median time to resolve</dt>
                      <dd className="mt-1 text-3xl font-bold tracking-tight">{d.medianResolveHours === null ? "—" : `${d.medianResolveHours}h`}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Kindness reminders shown</dt>
                      <dd className="mt-1 text-3xl font-bold tracking-tight">{d.kindnessPrompts ?? "—"}</dd>
                      {d.kindnessPrompts === null && <dd className="text-xs text-muted-foreground">Not tracked yet (planned)</dd>}
                    </div>
                  </dl>
                </Panel>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}
