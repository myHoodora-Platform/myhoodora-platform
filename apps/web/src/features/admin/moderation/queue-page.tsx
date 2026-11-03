"use client";

import { FileText, Flag, MessageSquare, ShoppingBag, User as UserIcon, UsersRound, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { REASON_LABEL, timeAgo } from "@/components/admin/format";
import { listReports, type ReportQuery } from "@/lib/api/admin/moderation";
import type { AdminReport, ReportTargetType } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

const TYPE_ICON: Record<ReportTargetType, LucideIcon> = {
  post: FileText,
  comment: MessageSquare,
  listing: ShoppingBag,
  message: MessageSquare,
  user: UserIcon,
  group: UsersRound,
  business: ShoppingBag,
};

const TYPE_LABEL: Record<ReportTargetType, string> = {
  post: "Post",
  comment: "Comment",
  listing: "Listing",
  message: "Message",
  user: "Account",
  group: "Group",
  business: "Business",
};

const TABS = [
  { value: "active", label: "To review" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

export function reportHref(r: AdminReport) {
  return `/admin/moderation/reports/${encodeURIComponent(r.id)}`;
}

export function QueuePage() {
  const { get, set, page, key } = useListParams<"status" | "type" | "reason" | "severity">({ status: "active" });
  const query: ReportQuery = {
    status: get("status") as ReportQuery["status"],
    type: (get("type") || undefined) as ReportTargetType | undefined,
    reason: get("reason") || undefined,
    severity: (get("severity") || undefined) as ReportQuery["severity"],
    q: get("q") || undefined,
    page,
  };
  const reports = useAdminQuery((u) => listReports(u, query), key, ["queue.changed"]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Moderation" }, { label: "Queue" }]}
        title="Moderation queue"
        description="Reports from neighbours, most serious first. Account reports and high-risk reasons (scams, harassment, misinformation) are staff-only."
      />

      <StatusTabs tabs={[...TABS]} active={get("status") as (typeof TABS)[number]["value"]} onChange={(v) => set({ status: v })} />

      <AdminToolbar count={countLabel(reports.data, "report")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search content or author" />
        <FilterSelect
          label="Type"
          value={get("type")}
          onChange={(v) => set({ type: v })}
          options={(["post", "comment", "listing", "user", "group"] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />
        <FilterSelect label="Reason" value={get("reason")} onChange={(v) => set({ reason: v })} options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect
          label="Severity"
          value={get("severity")}
          onChange={(v) => set({ severity: v })}
          options={[
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
      </AdminToolbar>

      <DataTable
        page={reports.data}
        loading={reports.loading}
        refreshing={reports.refreshing}
        error={reports.error}
        onRetry={reports.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(r) => r.id}
        rowHref={reportHref}
        primary={(r) => (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={r.severity} />
              <span className="text-xs font-semibold text-muted-foreground">{TYPE_LABEL[r.target.type]}</span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold">{r.target.preview}</p>
          </div>
        )}
        columns={[
          {
            header: "Reported content",
            className: "min-w-[260px]",
            cell: (r) => {
              const Icon = TYPE_ICON[r.target.type];
              return (
                <span className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="line-clamp-2">{r.target.preview}</span>
                </span>
              );
            },
          },
          {
            header: "Reason",
            mobile: true,
            cell: (r) => (
              <span className="text-sm">
                {REASON_LABEL[r.reasons[0]!.reason]}
                {r.reasons.length > 1 && <span className="text-muted-foreground"> +{r.reasons.length - 1}</span>}
              </span>
            ),
          },
          { header: "Reports", mobile: true, cell: (r) => <span className="tabular-nums">{r.reporterCount}</span>, className: "text-center" },
          { header: "Severity", cell: (r) => <StatusBadge status={r.severity} /> },
          {
            header: "Status",
            mobile: true,
            cell: (r) => (r.assignee && r.status === "under_review" ? <StatusBadge status="under_review" label={`${r.assignee.displayName.split(" ")[0]} reviewing`} /> : <StatusBadge status={r.status} />),
          },
          { header: "Reported", mobile: true, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(r.firstReportedAt)}</span> },
        ]}
        empty={
          <EmptyBody
            icon={Flag}
            title={get("status") === "active" ? "Nothing to review" : "No reports here"}
            description={get("status") === "active" ? "When neighbours report posts, comments, listings or accounts, they appear here." : "Try another tab or clear the filters."}
          />
        }
      />
    </div>
  );
}
