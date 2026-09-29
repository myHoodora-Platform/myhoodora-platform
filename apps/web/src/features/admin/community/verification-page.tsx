"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, UserCheck } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Pager } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { timeAgo } from "@/components/admin/format";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { listVerification } from "@/lib/api/admin/community";
import type { NeighbourAction, VerificationCase } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { NeighbourActionDialog } from "./neighbour-action";

const ERROR: Record<string, string> = {
  outside_coverage: "Outside our coverage",
  low_accuracy: "Location too imprecise",
  mismatch: "Pin didn't match the address",
};

function km(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function VerificationPage() {
  const { can } = useAdminSession();
  const { get, set, page, key } = useListParams<"status">({ status: "pending_review" });
  const cases = useAdminQuery(
    (u) => listVerification(u, { status: get("status") as "pending_review" | "failed", q: get("q") || undefined, page }),
    key,
  );
  const [pending, setPending] = useState<{ action: NeighbourAction; c: VerificationCase; hoodId?: string } | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Verification" }]}
        title="Verification"
        description="Neighbours whose address check needs a human. Oldest first, so nobody waits too long for access."
      />
      <StatusTabs
        active={get("status") as "pending_review" | "failed"}
        onChange={(v) => set({ status: v })}
        tabs={[
          { value: "pending_review", label: "Asked for review" },
          { value: "failed", label: "Check failed" },
        ]}
      />
      <AdminToolbar count={cases.data ? `${cases.data.total} waiting` : undefined}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search name or address" />
      </AdminToolbar>

      {cases.error && !cases.data ? (
        <AdminProblem error={cases.error} onRetry={cases.refetch} />
      ) : !cases.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : cases.data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyBody icon={UserCheck} title="No one is waiting" description="New address checks that need a human will appear here." />
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.data.items.map((c) => {
            const nearest = c.nearestHoods[0];
            return (
              <li key={c.uid} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/neighbours/${c.uid}`} className="font-bold hover:text-primary hover:underline">
                        {c.displayName}
                      </Link>
                      <StatusBadge status={c.status} />
                      {c.lastError && <span className="text-xs font-semibold text-muted-foreground">{ERROR[c.lastError]}</span>}
                    </div>
                    <p className="flex items-start gap-1.5 text-sm">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {c.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {timeAgo(c.submittedAt)} · {c.attempts} {c.attempts === 1 ? "attempt" : "attempts"} · {c.point.lat.toFixed(4)}, {c.point.lng.toFixed(4)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {c.nearestHoods.map((h, i) => (
                        <span key={h.id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i === 0 && h.distanceMeters < 3000 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {h.name} · {km(h.distanceMeters)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {can("verification.review") && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => setPending({ action: "verify", c, hoodId: nearest && nearest.distanceMeters < 5000 ? nearest.id : undefined })}>
                        {nearest && nearest.distanceMeters < 5000 ? `Approve into ${nearest.name}` : "Approve…"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPending({ action: "reject_verification", c })}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cases.data && <Pager page={cases.data} onPage={(p) => set({ page: String(p) })} />}

      <NeighbourActionDialog
        action={pending?.action ?? null}
        targets={pending ? [{ uid: pending.c.uid, displayName: pending.c.displayName, hoodId: pending.hoodId }] : []}
        onClose={() => setPending(null)}
        onDone={() => void cases.refetch()}
      />
    </div>
  );
}
