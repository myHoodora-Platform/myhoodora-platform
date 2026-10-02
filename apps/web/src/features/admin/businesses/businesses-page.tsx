"use client";

import { Building2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody, Unauthorized } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { timeAgo } from "@/components/admin/format";
import { listBusinesses, type BusinessTab } from "@/lib/api/admin/businesses";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

export function BusinessesPage() {
  const { can } = useAdminSession();
  const { get, set, page, key } = useListParams<"tab">({ tab: "applications" });
  const tab = get("tab") as BusinessTab;
  const businesses = useAdminQuery((u) => listBusinesses(u, { tab, q: get("q") || undefined, page }), key);

  if (!can("businesses.review")) return <Unauthorized message="Business approvals are handled by admins." />;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Businesses" }]}
        title="Businesses"
        description="Applications from /business/get-started, verified Business Pages and pages neighbours have reported. Oldest applications first."
      />
      <StatusTabs<BusinessTab>
        active={tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: "applications", label: "Applications" },
          { value: "verified", label: "Verified" },
          { value: "reported", label: "Reported or suspended" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
      <AdminToolbar count={countLabel(businesses.data, "business")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search name, owner or area" />
      </AdminToolbar>
      <DataTable
        page={businesses.data}
        loading={businesses.loading}
        refreshing={businesses.refreshing}
        error={businesses.error}
        onRetry={businesses.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(b) => b.id}
        rowHref={(b) => `/admin/businesses/${b.id}`}
        primary={(b) => (
          <div>
            <p className="font-semibold">{b.name}</p>
            <p className="text-xs text-muted-foreground">
              {b.category} · {b.owner.name}
            </p>
          </div>
        )}
        columns={[
          { header: "Business", className: "min-w-[200px]", cell: (b) => b.name },
          { header: "Category", cell: (b) => b.category },
          { header: "Owner", cell: (b) => b.owner.name },
          { header: "Areas", mobile: true, cell: (b) => <span className="line-clamp-1 text-muted-foreground">{b.areasServed.join(", ")}</span> },
          { header: "CAC", cell: (b) => (b.cacNumber ? <span className="font-mono text-xs">{b.cacNumber}</span> : <span className="text-muted-foreground">Not given</span>) },
          { header: "Status", mobile: true, cell: (b) => <StatusBadge status={b.status} /> },
          { header: "Applied", mobile: true, cell: (b) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(b.appliedAt)}</span> },
        ]}
        empty={
          <EmptyBody
            icon={Building2}
            title={tab === "applications" ? "No applications waiting" : "Nothing here"}
            description={tab === "applications" ? "New Business Page applications from /business/get-started appear here." : "Try another tab."}
          />
        }
      />
    </div>
  );
}
