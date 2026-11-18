"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, CircleDot, Flag, Rocket, TrendingUp } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { getActivation, getChallengeDashboard, type ChallengeDashboard, type Light } from "@/lib/api/admin/dashboards";
import { useAdminQuery } from "../use-admin-query";

/** Status, always with an icon and a word: never colour alone. */
const LIGHT: Record<Light, { label: string; Icon: typeof CircleCheck; className: string }> = {
  green: { label: "Activated", Icon: CircleCheck, className: "text-emerald-700 dark:text-emerald-300" },
  amber: { label: "Growing", Icon: CircleDot, className: "text-amber-700 dark:text-amber-300" },
  red: { label: "Nearly empty", Icon: CircleAlert, className: "text-red-700 dark:text-red-300" },
};

const ADVICE: Record<ChallengeDashboard["advice"], { title: string; Icon: typeof Rocket }> = {
  keep_going: { title: "Keep the challenge going", Icon: TrendingUp },
  push_harder: { title: "Push harder in the quiet Hoods", Icon: Rocket },
  consider_ending: { title: "Consider ending or renaming the challenge", Icon: Flag },
};

const FUNNEL: [string, string][] = [
  ["shared_view", "Shared posts opened (signed out)"],
  ["shared_join_tap", "…tapped to join"],
  ["invite_view", "Invite links opened"],
  ["poster_view", "Posters scanned"],
  ["banner_open", "“Open in the app” taps"],
  ["sheet_open", "“Better in the app” taps"],
];

/**
 * Admin → Activation (plan WP-F): every Hood against the activated checklist, and the launch challenge's
 * numbers with what the plan's rules say to do next.
 */
export function DashboardsPage() {
  const activation = useAdminQuery((u) => getActivation(u), "dash-activation");
  const challenge = useAdminQuery((u) => getChallengeDashboard(u), "dash-challenge");
  const [filter, setFilter] = useState<Light | "all">("all");

  if (activation.error && !activation.data) return <AdminProblem error={activation.error} onRetry={() => void activation.refetch()} />;
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Activation & challenge" description="Is every Hood lived-in yet, and is the launch challenge still bringing people in? A Hood is activated with 15+ posts in 30 days, 5+ verified neighbours, a Hood Lead, a welcome post and a moderator." />

      {challenge.data && <ChallengeSection data={challenge.data} />}

      <Panel title="Hoods">
        {!activation.data ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        ) : (
          <>
            <div role="tablist" aria-label="Filter Hoods" className="mb-3 flex flex-wrap gap-2 text-sm">
              {(["all", "red", "amber", "green"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn("rounded-full border px-3 py-1", filter === f ? "border-primary bg-primary/10 font-semibold" : "border-border")}
                >
                  {f === "all" ? `All (${activation.data?.rows.length ?? 0})` : `${LIGHT[f].label} (${activation.data?.counts[f] ?? 0})`}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Hood</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">Neighbours</th>
                    <th className="py-2 pr-3 text-right font-medium">Posts (30 d)</th>
                    <th className="py-2 pr-3 text-right font-medium">Hood Team share</th>
                    <th className="py-2 font-medium">Still needs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activation.data.rows
                    .filter((r) => filter === "all" || r.light === filter)
                    .map((r) => {
                      const L = LIGHT[r.light];
                      const share = r.items ? Math.round((r.teamItems / r.items) * 100) : 0;
                      return (
                        <tr key={r.hood.id}>
                          <td className="py-2 pr-3">
                            <Link href={`/admin/hoods/${r.hood.id}`} className="font-semibold hover:text-primary hover:underline">
                              {r.hood.name}
                            </Link>
                            {r.hood.city && <span className="ml-1 text-xs text-muted-foreground">{r.hood.city}</span>}
                          </td>
                          <td className={cn("py-2 pr-3 whitespace-nowrap", L.className)}>
                            <span className="inline-flex items-center gap-1.5">
                              <L.Icon className="size-4" aria-hidden /> {L.label}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.neighbours}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.items}</td>
                          <td className={cn("py-2 pr-3 text-right tabular-nums", share > 30 && "font-semibold text-amber-700 dark:text-amber-300")} title="The plan aims for under 30% within a month">
                            {r.items ? `${share}%` : "—"}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{r.missing.join(" · ") || "Nothing"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function ChallengeSection({ data }: { data: ChallengeDashboard }) {
  const A = ADVICE[data.advice];
  const max = Math.max(1, ...data.weekly.map((w) => w.invitedVerified));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Panel title="Verified neighbours who joined from an invite, per week">
        <div className="flex h-40 items-end gap-2 border-b border-border pb-px" role="img" aria-label={`Weekly verified sign-ups from invites: ${data.weekly.map((w) => `week of ${w.week}: ${w.invitedVerified}`).join(", ")}`}>
          {data.weekly.map((w, i) => (
            <div key={w.week} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm">
                  Week of {w.week}: <span className="font-semibold">{w.invitedVerified}</span> verified from invites · {w.signups} sign-ups in all
                </div>
              )}
              <div className="rounded-t bg-primary" style={{ height: `${Math.max(2, (w.invitedVerified / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
          {data.weekly.map((w) => (
            <span key={w.week} className="flex-1 truncate text-center">
              {w.week.slice(5)}
            </span>
          ))}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Table</summary>
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Week of</th>
                <th className="py-1 text-right font-medium">Sign-ups</th>
                <th className="py-1 text-right font-medium">With an invite</th>
                <th className="py-1 text-right font-medium">…and verified</th>
              </tr>
            </thead>
            <tbody>
              {data.weekly.map((w) => (
                <tr key={w.week} className="border-t border-border">
                  <td className="py-1">{w.week}</td>
                  <td className="py-1 text-right tabular-nums">{w.signups}</td>
                  <td className="py-1 text-right tabular-nums">{w.invited}</td>
                  <td className="py-1 text-right tabular-nums">{w.invitedVerified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Panel>
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <A.Icon className="size-5 text-primary" aria-hidden /> {A.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{data.why}</p>
          <Link href="/admin/engagement" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Challenge settings <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Panel title="Since the challenge began">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Hood Builders</dt>
              <dd className="font-semibold tabular-nums">{data.builders}</dd>
            </div>
            {FUNNEL.map(([key, label]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{(data.funnel[key] ?? 0).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
