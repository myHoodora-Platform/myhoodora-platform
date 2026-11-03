"use client";

import { History } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { auditSentence } from "@/components/admin/timeline";
import { dateTimeLabel, timeAgo } from "@/components/admin/format";
import { listAudit } from "@/lib/api/admin/moderation";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

const ACTIONS = [
  ["remove_content", "Removed content"],
  ["restore_content", "Restored content"],
  ["keep", "Kept (no violation)"],
  ["warn_author", "Warned author"],
  ["restrict", "Restricted"],
  ["restrict_author", "Restricted author"],
  ["suspend", "Suspended"],
  ["reinstate", "Reinstated"],
  ["verify", "Verified"],
  ["escalate", "Escalated"],
] as const;

export function HistoryPage() {
  const { get, set, page, key } = useListParams<"action" | "targetType">();
  const events = useAdminQuery(
    (u) => listAudit(u, { q: get("q") || undefined, action: get("action") || undefined, targetType: get("targetType") || undefined, page }),
    key,
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Moderation" }, { label: "History" }]}
        title="Moderation history"
        description="Every staff action, who took it and why. This log can't be edited."
      />
      <AdminToolbar count={countLabel(events.data, "action")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search staff, target or reason" />
        <FilterSelect label="Action" value={get("action")} onChange={(v) => set({ action: v })} options={ACTIONS.map(([value, label]) => ({ value, label }))} />
        <FilterSelect
          label="On"
          value={get("targetType")}
          onChange={(v) => set({ targetType: v })}
          options={[
            { value: "post", label: "Posts" },
            { value: "comment", label: "Comments" },
            { value: "listing", label: "Listings" },
            { value: "user", label: "Neighbours" },
            { value: "hood", label: "Hoods" },
            { value: "business", label: "Businesses" },
          ]}
        />
      </AdminToolbar>
      <DataTable
        page={events.data}
        loading={events.loading}
        refreshing={events.refreshing}
        error={events.error}
        onRetry={events.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(e) => e.id}
        primary={(e) => <p className="text-sm font-medium">{auditSentence(e)}</p>}
        columns={[
          { header: "What happened", className: "min-w-[280px]", cell: (e) => <span className="font-medium">{auditSentence(e)}</span> },
          { header: "Reason", mobile: true, cell: (e) => <span className="text-muted-foreground">{e.reason ?? "—"}</span> },
          { header: "Role", cell: (e) => <span className="capitalize">{e.actor.role}</span> },
          { header: "When", mobile: true, cell: (e) => <span className="whitespace-nowrap text-muted-foreground" title={dateTimeLabel(e.at)}>{timeAgo(e.at)}</span> },
        ]}
        empty={<EmptyBody icon={History} title="No actions match" description="Clear the filters to see everything." />}
      />
    </div>
  );
}
