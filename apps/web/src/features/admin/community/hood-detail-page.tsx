"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton } from "@/components/admin/admin-states";
import { ActionDialog } from "@/components/admin/action-dialog";
import { StatusTabs } from "@/components/admin/admin-toolbar";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { CATEGORY_LABEL, REASON_LABEL, dateLabel, initials, timeAgo } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { getHood, listNeighbours, updateHood } from "@/lib/api/admin/community";
import { listPosts } from "@/lib/api/admin/content";
import { listReports } from "@/lib/api/admin/moderation";
import type { HoodStatus } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { reportHref } from "../moderation/queue-page";
import { HoodLeadsPanel } from "./hood-leads-panel";

const HoodMap = dynamic(() => import("./hood-map").then((m) => m.HoodMap), { ssr: false, loading: () => <div className="h-56 animate-pulse bg-muted" /> });

type Tab = "members" | "posts" | "reports";

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${36 - ((p - min) / span) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <polyline points={`0,40 ${d} 100,40`} fill="rgba(20,124,115,0.1)" stroke="none" />
      <polyline points={d} fill="none" stroke="#147C73" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HoodDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const hood = useAdminQuery((u) => getHood(u, id), id);
  const members = useAdminQuery((u) => listNeighbours(u, { hoodId: id, pageSize: 10 }), `m-${id}`);
  const posts = useAdminQuery((u) => listPosts(u, { hoodId: id, pageSize: 10 }), `p-${id}`);
  const reports = useAdminQuery((u) => listReports(u, { hoodId: id, status: "active", pageSize: 10 }), `r-${id}`);
  const [tab, setTab] = useState<Tab>("members");
  const [dialog, setDialog] = useState<null | "edit" | HoodStatus>(null);
  const [form, setForm] = useState({ name: "", radius: 1500, description: "" });

  if (hood.loading && !hood.data) return <DetailSkeleton />;
  if (!hood.data) return <AdminProblem error={hood.error} onRetry={hood.refetch} backHref="/admin/hoods" />;
  const h = hood.data;

  const save = async (patch: Parameters<typeof updateHood>[2]) => {
    if (!user) return;
    const next = await updateHood(user, id, patch, role);
    hood.setData(next);
    toast.success("Hood updated");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Hoods", href: "/admin/hoods" }, { label: h.name }]}
        title={h.name}
        description={h.description}
        meta={
          <>
            <StatusBadge status={h.status} />
            <span className="text-xs text-muted-foreground">
              {h.city}, {h.country} · live since {dateLabel(h.createdAt)}
            </span>
          </>
        }
        actions={
          can("hoods.manage") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({ name: h.name, radius: h.radiusMeters, description: h.description ?? "" });
                  setDialog("edit");
                }}
              >
                Edit
              </Button>
              {h.status === "active" ? (
                <Button variant="outline" size="sm" onClick={() => setDialog("paused")}>
                  Pause
                </Button>
              ) : h.status === "paused" ? (
                <Button size="sm" onClick={() => setDialog("active")}>
                  Resume
                </Button>
              ) : null}
              {h.status !== "archived" && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDialog("archived")}>
                  Archive
                </Button>
              )}
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Members", h.stats.members.toLocaleString()],
          ["Verified", `${h.stats.verifiedPct}%`],
          ["Posts (7d)", h.stats.posts7d],
          ["Open reports", h.stats.openReports],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <DetailLayout
        main={
          <>
            <Panel title="Members, last 14 days" action={<span className={`text-sm font-semibold ${h.stats.growth7d >= 0 ? "text-emerald-600" : "text-red-600"}`}>{h.stats.growth7d >= 0 ? "+" : ""}{h.stats.growth7d} this week</span>}>
              <Sparkline points={h.members7d.map((m) => m.members)} />
            </Panel>
            <StatusTabs<Tab>
              active={tab}
              onChange={setTab}
              tabs={[
                { value: "members", label: "Members", count: members.data?.total },
                { value: "posts", label: "Posts", count: posts.data?.total },
                { value: "reports", label: "Open reports", count: reports.data?.total },
              ]}
            />
            <Panel padded={false}>
              {tab === "members" &&
                (members.data?.items.length ? (
                  <ul className="divide-y divide-border">
                    {members.data.items.map((n) => (
                      <li key={n.uid}>
                        <Link href={`/admin/neighbours/${n.uid}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(n.displayName)}</span>
                          <span className="flex-1 text-sm font-medium">{n.displayName}</span>
                          <StatusBadge status={n.accountStatus} />
                        </Link>
                      </li>
                    ))}
                    {members.data.total > members.data.items.length && (
                      <li className="px-5 py-3 text-sm">
                        <Link href={`/admin/neighbours?q=${encodeURIComponent(h.name)}`} className="font-semibold text-primary hover:underline">
                          See all {members.data.total} members
                        </Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">No members in the preview data yet.</p>
                ))}
              {tab === "posts" &&
                (posts.data?.items.length ? (
                  <ul className="divide-y divide-border">
                    {posts.data.items.map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/posts/${p.id}`} className="block px-5 py-3 hover:bg-muted/40">
                          <p className="line-clamp-1 text-sm">{p.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.author.displayName} · {CATEGORY_LABEL[p.category] ?? p.category} · {timeAgo(p.createdAt)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">No posts yet.</p>
                ))}
              {tab === "reports" &&
                (reports.data?.items.length ? (
                  <ul className="divide-y divide-border">
                    {reports.data.items.map((r) => (
                      <li key={r.id}>
                        <Link href={reportHref(r)} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                          <StatusBadge status={r.severity} />
                          <span className="line-clamp-1 flex-1 text-sm">{r.target.preview}</span>
                          <span className="text-xs text-muted-foreground">{REASON_LABEL[r.reasons[0]!.reason]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">No open reports in {h.name}.</p>
                ))}
            </Panel>
          </>
        }
        aside={
          <>
            <Panel title="Boundary" padded={false}>
              <HoodMap lat={h.center.lat} lng={h.center.lng} radiusMeters={h.radiusMeters} className="h-56 w-full overflow-hidden" />
              <div className="p-5">
                <KeyValues
                  items={[
                    { label: "Centre", value: `${h.center.lat.toFixed(4)}, ${h.center.lng.toFixed(4)}` },
                    { label: "Radius", value: `${(h.radiusMeters / 1000).toFixed(1)} km` },
                  ]}
                />
              </div>
            </Panel>
            <HoodLeadsPanel hoodId={id} />
            <Panel title="History">
              <Timeline events={h.timeline} empty="No changes since this Hood went live." />
            </Panel>
          </>
        }
      />

      {dialog === "edit" && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Edit ${h.name}`}
          consequence="Changes apply straight away. Changing the radius affects who can verify into this Hood from now on; existing members stay."
          confirmLabel="Save changes"
          requireReason={false}
          ready={form.name.trim().length >= 2}
          onConfirm={({ note }) => save({ name: form.name.trim(), radiusMeters: form.radius, description: form.description.trim() || undefined, reason: note })}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldInputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Radius: {(form.radius / 1000).toFixed(1)} km</span>
            <input type="range" min={300} max={6000} step={100} value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={fieldInputClass} />
          </label>
        </ActionDialog>
      )}
      {(dialog === "paused" || dialog === "active" || dialog === "archived") && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={dialog === "paused" ? `Pause ${h.name}` : dialog === "active" ? `Resume ${h.name}` : `Archive ${h.name}`}
          consequence={
            dialog === "paused"
              ? "New neighbours can't verify into this Hood while it's paused. Existing members keep full access."
              : dialog === "active"
                ? "New neighbours can verify into this Hood again."
                : "The Hood is hidden and closed to new members. Members, posts and history are kept, nothing is deleted. You can restore it from Hoods › Status: Archived."
          }
          reasons={dialog === "active" ? ["Boundary fixed", "Ready to relaunch"] : ["Boundary is being redrawn", "Merged into another Hood", "Too few residents", "Created by mistake"]}
          destructive={dialog === "archived"}
          confirmLabel={dialog === "paused" ? "Pause" : dialog === "active" ? "Resume" : "Archive"}
          onConfirm={({ reason, note }) => save({ status: dialog, reason: note ? `${reason} · ${note}` : reason })}
        />
      )}
    </div>
  );
}
