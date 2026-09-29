"use client";

import { useState } from "react";
import { BadgeCheck, UsersRound } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { listGroupsAdmin } from "@/lib/api/admin/content";
import type { AdminGroup } from "@/lib/api/admin/types";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { ContentActionDialog, type ContentTarget } from "./content-action";

type View = "active" | "reported" | "archived";

export function GroupsPage() {
  const { get, set, page, key } = useListParams<"view">({ view: "active" });
  const view = get("view") as View;
  const groups = useAdminQuery(
    (u) =>
      listGroupsAdmin(u, {
        q: get("q") || undefined,
        reported: view === "reported" || undefined,
        status: view === "reported" ? undefined : (view as AdminGroup["status"]),
        page,
      }),
    key,
  );
  const [target, setTarget] = useState<ContentTarget | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Groups" }]}
        title="Groups"
        description="Street, estate, parents' and safety-watch groups. Group admins run their own groups; step in only for reports or abandoned groups."
      />
      <StatusTabs<View>
        active={view}
        onChange={(v) => set({ view: v })}
        tabs={[
          { value: "active", label: "Active" },
          { value: "reported", label: "Reported" },
          { value: "archived", label: "Archived" },
        ]}
      />
      <AdminToolbar count={countLabel(groups.data, "group")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search groups" />
      </AdminToolbar>
      <DataTable
        page={groups.data}
        loading={groups.loading}
        refreshing={groups.refreshing}
        error={groups.error}
        onRetry={groups.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(g) => g.id}
        primary={(g) => (
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              {g.name} {g.official && <BadgeCheck className="size-4 text-primary" aria-label="Official" />}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {g.privacy} · {g.category.replace(/_/g, " ")}
            </p>
          </div>
        )}
        columns={[
          {
            header: "Group",
            className: "min-w-[220px]",
            cell: (g) => (
              <span className="flex items-center gap-1.5 font-semibold">
                {g.name} {g.official && <BadgeCheck className="size-4 text-primary" aria-label="Official" />}
              </span>
            ),
          },
          { header: "Privacy", cell: (g) => <span className="capitalize">{g.privacy}</span> },
          { header: "Members", mobile: true, className: "text-right", cell: (g) => <span className="tabular-nums">{g.members}</span> },
          { header: "Hood", mobile: true, cell: (g) => g.hood?.name ?? "—" },
          { header: "Status", mobile: true, cell: (g) => (g.openReports && g.status === "active" ? <StatusBadge status="escalated" label={`${g.openReports} report`} /> : <StatusBadge status={g.status} />) },
        ]}
        actions={[
          { label: "Archive group", destructive: true, hidden: (g) => g.status === "archived", onSelect: (g) => setTarget({ type: "group", id: g.id, label: g.name, action: "remove" }) },
          { label: "Restore group", hidden: (g) => g.status !== "archived", onSelect: (g) => setTarget({ type: "group", id: g.id, label: g.name, action: "restore" }) },
        ]}
        empty={<EmptyBody icon={UsersRound} title="No groups here" description="Try another tab." />}
      />
      <ContentActionDialog target={target} onClose={() => setTarget(null)} onDone={() => void groups.refetch()} />
    </div>
  );
}
