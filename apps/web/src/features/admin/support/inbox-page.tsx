"use client";

import { Inbox } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { timeAgo } from "@/components/admin/format";
import { listInbox } from "@/lib/api/admin/support";
import type { InboxStatus, InboxThread } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

export const SOURCE_LABEL: Record<InboxThread["source"], string> = {
  in_app: "In-app",
  contact_form: "Contact form",
  feedback: "Feedback",
};

export function InboxPage() {
  const { get, set, page, key } = useListParams<"status" | "source">({ status: "open" });
  const threads = useAdminQuery(
    (u) => listInbox(u, { status: get("status") as InboxStatus, source: (get("source") || undefined) as InboxThread["source"] | undefined, q: get("q") || undefined, page }),
    key,
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Support" }, { label: "Inbox" }]}
        title="Inbox"
        description="Questions from neighbours in the app, the public contact form and feedback, in one queue. High priority first."
      />
      <StatusTabs<InboxStatus>
        active={get("status") as InboxStatus}
        onChange={(v) => set({ status: v })}
        tabs={[
          { value: "open", label: "Needs a reply" },
          { value: "waiting", label: "Waiting on neighbour" },
          { value: "resolved", label: "Resolved" },
        ]}
      />
      <AdminToolbar count={countLabel(threads.data, "conversation")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search messages, names or emails" />
        <FilterSelect label="Source" value={get("source")} onChange={(v) => set({ source: v })} options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
      </AdminToolbar>
      <DataTable
        page={threads.data}
        loading={threads.loading}
        refreshing={threads.refreshing}
        error={threads.error}
        onRetry={threads.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(t) => t.id}
        rowHref={(t) => `/admin/inbox/${encodeURIComponent(t.id)}`}
        primary={(t) => (
          <div>
            <p className="font-semibold">{t.subject}</p>
            <p className="line-clamp-1 text-sm text-muted-foreground">{t.messages[t.messages.length - 1]?.body}</p>
          </div>
        )}
        columns={[
          {
            header: "Conversation",
            className: "min-w-[280px]",
            cell: (t) => (
              <span className="block">
                <span className="block">{t.subject}</span>
                <span className="line-clamp-1 text-xs font-normal text-muted-foreground">{t.messages[t.messages.length - 1]?.body}</span>
              </span>
            ),
          },
          { header: "From", mobile: true, cell: (t) => <span className="whitespace-nowrap">{t.from.name}</span> },
          { header: "Source", cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{SOURCE_LABEL[t.source]}</span> },
          { header: "Priority", mobile: true, cell: (t) => <StatusBadge status={t.priority === "normal" ? "medium" : t.priority} label={t.priority[0]!.toUpperCase() + t.priority.slice(1)} /> },
          { header: "Updated", mobile: true, cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(t.updatedAt)}</span> },
        ]}
        empty={<EmptyBody icon={Inbox} title={get("status") === "open" ? "Inbox zero" : "Nothing here"} description={get("status") === "open" ? "Every message has a reply. New ones land here." : "Try another tab."} />}
      />
    </div>
  );
}
