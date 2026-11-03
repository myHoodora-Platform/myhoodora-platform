"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, MapPin, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { listHoods } from "@/lib/api/admin/community";
import type { HoodStatus } from "@/lib/api/admin/types";
import { COVERAGE } from "@/lib/coverage";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

export function HoodsPage() {
  const { can } = useAdminSession();
  const { get, set, page, key } = useListParams<"city" | "status">();
  const hoods = useAdminQuery(
    (u) => listHoods(u, { q: get("q") || undefined, city: get("city") || undefined, status: (get("status") || undefined) as HoodStatus | undefined, sort: get("sort") || undefined, page }),
    key,
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Hoods" }]}
        title="Hoods"
        description="Every neighbourhood we're live in. Spot which are growing, which are quiet and which have open reports."
        actions={
          can("hoods.manage") && (
            <Link href="/admin/hoods/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" aria-hidden /> New Hood
            </Link>
          )
        }
      />
      <AdminToolbar count={countLabel(hoods.data, "Hood")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search Hoods" />
        <FilterSelect label="City" value={get("city")} onChange={(v) => set({ city: v })} options={COVERAGE.map((c) => ({ value: c.city, label: c.city }))} />
        <FilterSelect
          label="Status"
          value={get("status")}
          onChange={(v) => set({ status: v })}
          options={[
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <FilterSelect
          label="Sort"
          value={get("sort")}
          onChange={(v) => set({ sort: v })}
          options={[
            { value: "members:desc", label: "Most members" },
            { value: "growth:desc", label: "Fastest growing" },
            { value: "growth:asc", label: "Needs attention" },
            { value: "reports:desc", label: "Most open reports" },
            { value: "name:asc", label: "Name A–Z" },
          ]}
        />
      </AdminToolbar>
      <DataTable
        page={hoods.data}
        loading={hoods.loading}
        refreshing={hoods.refreshing}
        error={hoods.error}
        onRetry={hoods.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(h) => h.id}
        rowHref={(h) => `/admin/hoods/${h.id}`}
        primary={(h) => (
          <div>
            <p className="font-semibold">{h.name}</p>
            <p className="text-xs text-muted-foreground">{h.city}</p>
          </div>
        )}
        columns={[
          {
            header: "Hood",
            cell: (h) => (
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden /> {h.name}
              </span>
            ),
          },
          { header: "City", cell: (h) => h.city },
          { header: "Members", mobile: true, className: "text-right", cell: (h) => <span className="tabular-nums">{h.stats.members.toLocaleString()}</span> },
          { header: "Verified", className: "text-right", cell: (h) => <span className="tabular-nums">{h.stats.verifiedPct}%</span> },
          { header: "Posts (7d)", mobile: true, className: "text-right", cell: (h) => <span className="tabular-nums">{h.stats.posts7d}</span> },
          {
            header: "Growth (7d)",
            className: "text-right",
            cell: (h) => (
              <span className={`inline-flex items-center gap-0.5 tabular-nums ${h.stats.growth7d > 0 ? "text-emerald-600" : h.stats.growth7d < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {h.stats.growth7d > 0 ? <ArrowUpRight className="size-3.5" /> : h.stats.growth7d < 0 ? <ArrowDownRight className="size-3.5" /> : null}
                {h.stats.growth7d > 0 ? "+" : ""}
                {h.stats.growth7d}
              </span>
            ),
          },
          {
            header: "Open reports",
            mobile: true,
            className: "text-right",
            cell: (h) => <span className={h.stats.openReports ? "font-bold text-[#c2412f]" : "text-muted-foreground"}>{h.stats.openReports}</span>,
          },
          { header: "Status", cell: (h) => <StatusBadge status={h.status} /> },
        ]}
        empty={<EmptyBody icon={MapPin} title="No Hoods match" description="Try another city or status." />}
      />
    </div>
  );
}
