"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { naira, timeAgo } from "@/components/admin/format";
import { listListingsAdmin } from "@/lib/api/admin/content";
import type { AdminListing } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { ContentActionDialog, type ContentTarget } from "./content-action";

type View = "all" | "reported" | "active" | "removed";

export function MarketplacePage() {
  const router = useRouter();
  const { get, set, page, key } = useListParams<"view">({ view: "all" });
  const view = get("view") as View;
  const listings = useAdminQuery(
    (u) =>
      listListingsAdmin(u, {
        q: get("q") || undefined,
        reported: view === "reported" || undefined,
        status: view === "active" || view === "removed" ? (view as AdminListing["status"]) : undefined,
        page,
      }),
    key,
  );
  const [target, setTarget] = useState<ContentTarget | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Marketplace" }]}
        title="Marketplace"
        description="For Sale & Free listings across every Hood. Reported listings are the usual place scams show up first."
      />
      <StatusTabs<View>
        active={view}
        onChange={(v) => set({ view: v })}
        tabs={[
          { value: "all", label: "All" },
          { value: "reported", label: "Reported" },
          { value: "active", label: "Active" },
          { value: "removed", label: "Removed" },
        ]}
      />
      <AdminToolbar count={countLabel(listings.data, "listing")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search listings or sellers" />
      </AdminToolbar>
      <DataTable
        page={listings.data}
        loading={listings.loading}
        refreshing={listings.refreshing}
        error={listings.error}
        onRetry={listings.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(l) => l.id}
        primary={(l) => (
          <div>
            <p className="font-semibold">{l.title}</p>
            <p className="text-sm font-semibold text-primary">{naira(l.priceNaira)}</p>
          </div>
        )}
        columns={[
          { header: "Listing", className: "min-w-[220px]", cell: (l) => <span className="font-semibold">{l.title}</span> },
          { header: "Price", cell: (l) => <span className="whitespace-nowrap">{naira(l.priceNaira)}</span> },
          { header: "Seller", mobile: true, cell: (l) => l.seller.displayName },
          { header: "Hood", cell: (l) => l.hood?.name ?? "—" },
          {
            header: "Status",
            mobile: true,
            cell: (l) => (l.openReports && l.status !== "removed" ? <StatusBadge status="escalated" label={`${l.openReports} report${l.openReports > 1 ? "s" : ""}`} /> : <StatusBadge status={l.status} />),
          },
          { header: "Listed", mobile: true, cell: (l) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(l.createdAt)}</span> },
        ]}
        actions={[
          { label: "View seller", onSelect: (l) => router.push(`/admin/neighbours/${l.seller.uid}`) },
          { label: "Remove listing", destructive: true, hidden: (l) => l.status === "removed", onSelect: (l) => setTarget({ type: "listing", id: l.id, label: l.title, action: "remove" }) },
          { label: "Restore listing", hidden: (l) => l.status !== "removed", onSelect: (l) => setTarget({ type: "listing", id: l.id, label: l.title, action: "restore" }) },
        ]}
        empty={<EmptyBody icon={ShoppingBag} title="No listings here" description="Try another tab or search." />}
      />
      <ContentActionDialog target={target} onClose={() => setTarget(null)} onDone={() => void listings.refetch()} />
    </div>
  );
}
