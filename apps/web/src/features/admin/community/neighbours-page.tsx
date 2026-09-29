"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { dateLabel, initials, timeAgo } from "@/components/admin/format";
import { listNeighbours, type NeighbourQuery } from "@/lib/api/admin/community";
import type { AdminNeighbour, NeighbourAction } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { NeighbourActionDialog } from "./neighbour-action";

export function NeighboursPage() {
  const { can } = useAdminSession();
  const { get, set, page, key } = useListParams<"verification" | "account" | "role">();
  const query: NeighbourQuery = {
    q: get("q") || undefined,
    verification: (get("verification") || undefined) as NeighbourQuery["verification"],
    account: (get("account") || undefined) as NeighbourQuery["account"],
    role: (get("role") || undefined) as NeighbourQuery["role"],
    page,
  };
  const people = useAdminQuery((u) => listNeighbours(u, query), key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ action: NeighbourAction; targets: AdminNeighbour[] } | null>(null);

  const selectedRows = (people.data?.items ?? []).filter((n) => selected.has(n.uid));
  const act = (action: NeighbourAction, targets: AdminNeighbour[]) => setPending({ action, targets });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Neighbours" }]}
        title="Neighbours"
        description="Everyone on myHoodora. Open someone to see their Hood, activity, reports and history before acting."
      />

      <AdminToolbar count={countLabel(people.data, "neighbour")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search name, email or Hood" />
        <FilterSelect
          label="Verification"
          value={get("verification")}
          onChange={(v) => set({ verification: v })}
          options={[
            { value: "verified", label: "Verified" },
            { value: "pending_review", label: "Needs review" },
            { value: "unverified", label: "Unverified" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
        <FilterSelect
          label="Account"
          value={get("account")}
          onChange={(v) => set({ account: v })}
          options={[
            { value: "active", label: "Active" },
            { value: "restricted", label: "Restricted" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <FilterSelect
          label="Role"
          value={get("role")}
          onChange={(v) => set({ role: v })}
          options={[
            { value: "member", label: "Member" },
            { value: "moderator", label: "Moderator" },
            { value: "admin", label: "Admin" },
          ]}
        />
      </AdminToolbar>

      {selected.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card p-3 shadow-lg">
          <span className="px-1 text-sm font-semibold">{selected.size} selected</span>
          {can("verification.review") && (
            <Button size="sm" onClick={() => act("verify", selectedRows)}>
              Verify into Hood
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => act("restrict", selectedRows)}>
            Restrict
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden /> Clear
          </button>
        </div>
      )}

      <DataTable
        page={people.data}
        loading={people.loading}
        refreshing={people.refreshing}
        error={people.error}
        onRetry={people.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(n) => n.uid}
        rowHref={(n) => `/admin/neighbours/${n.uid}`}
        selection={{ selected, onChange: setSelected }}
        primary={(n) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(n.displayName)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{n.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{n.hood?.name ?? "No Hood yet"}</span>
            </span>
          </div>
        )}
        columns={[
          {
            header: "Neighbour",
            className: "min-w-[220px]",
            cell: (n) => (
              <span className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(n.displayName)}</span>
                <span className="min-w-0">
                  <span className="block truncate">{n.displayName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{n.email}</span>
                </span>
              </span>
            ),
          },
          { header: "Hood", cell: (n) => n.hood?.name ?? <span className="text-muted-foreground">—</span> },
          { header: "Verification", mobile: true, cell: (n) => <StatusBadge status={n.verificationStatus} /> },
          {
            header: "Account",
            mobile: true,
            cell: (n) => (
              <span className="flex items-center gap-1.5">
                <StatusBadge status={n.accountStatus} />
                {n.role !== "member" && <StatusBadge status={n.role} />}
              </span>
            ),
          },
          { header: "Joined", cell: (n) => <span className="whitespace-nowrap text-muted-foreground" title={dateLabel(n.joinedAt)}>{timeAgo(n.joinedAt)}</span> },
          {
            header: "Reports",
            className: "text-center",
            cell: (n) => <span className={n.counts.reportsAgainst ? "font-bold text-[#c2412f]" : "text-muted-foreground"}>{n.counts.reportsAgainst}</span>,
          },
        ]}
        actions={[
          { label: "Verify into Hood", onSelect: (n) => act("verify", [n]), hidden: (n) => n.verificationStatus === "verified" || !can("verification.review") },
          { label: "Send a warning", onSelect: (n) => act("warn", [n]) },
          { label: "Reinstate", onSelect: (n) => act("reinstate", [n]), hidden: (n) => n.accountStatus === "active" || !can("moderation.suspend") },
          { label: "Restrict", onSelect: (n) => act("restrict", [n]), destructive: true, hidden: (n) => n.accountStatus !== "active" },
          { label: "Suspend", onSelect: (n) => act("suspend", [n]), destructive: true, hidden: (n) => n.accountStatus === "suspended" || !can("moderation.suspend") },
        ]}
        empty={<EmptyBody icon={Users} title="No neighbours match" description="Try a different search or clear the filters." />}
      />

      <NeighbourActionDialog
        action={pending?.action ?? null}
        targets={(pending?.targets ?? []).map((t) => ({ uid: t.uid, displayName: t.displayName, hoodId: t.hood?.id }))}
        onClose={() => setPending(null)}
        onDone={() => {
          setSelected(new Set());
          void people.refetch();
        }}
      />
    </div>
  );
}
