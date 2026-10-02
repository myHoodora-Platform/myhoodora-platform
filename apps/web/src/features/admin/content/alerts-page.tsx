"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Siren } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { ActionDialog } from "@/components/admin/action-dialog";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { timeAgo } from "@/components/admin/format";
import { useAuth } from "@/context/AuthContext";
import { actOnAlert, listAlerts, type AdminAlert } from "@/lib/api/admin/content";
import { URGENT_WINDOW_HOURS } from "@/features/alerts/lifecycle";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

type Level = "live" | "urgent" | "resolved" | "ended";
type AlertAction = "end" | "downgrade" | "remove";

const SPEC: Record<AlertAction, { title: string; confirm: string; destructive?: boolean; reasons: string[]; consequence: string }> = {
  end: {
    title: "End this alert",
    confirm: "End alert",
    reasons: ["Situation is over", "Duplicate of another alert", "Poster asked us to"],
    consequence: "The alert stops being pinned and counted as live. The post stays in the feed and alert history.",
  },
  downgrade: {
    title: "Downgrade from urgent",
    confirm: "Downgrade",
    reasons: ["Not an immediate danger", "Should be a normal alert", "Duplicate urgent alert"],
    consequence: `The red banner goes away for everyone in the Hood. It stays an active alert for its normal window. Urgent is only for danger happening now (${URGENT_WINDOW_HOURS}h).`,
  },
  remove: {
    title: "Remove alert",
    confirm: "Remove",
    destructive: true,
    reasons: ["False alarm or hoax", "Misinformation", "Names or shames someone", "Not a safety issue"],
    consequence: "The alert is hidden from everyone and removed from counts and banners. The author is told why.",
  },
};

export function AlertsPage() {
  const { user } = useAuth();
  const { role } = useAdminSession();
  const { get, set, page, key } = useListParams<"level">({ level: "live" });
  const level = get("level") as Level;
  const alerts = useAdminQuery((u) => listAlerts(u, { level, q: get("q") || undefined, page }), key);
  const [pending, setPending] = useState<{ action: AlertAction; alert: AdminAlert } | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Safety alerts" }]}
        title="Safety alerts"
        description="What's live right now across every Hood. Urgent alerts show a red banner for everyone nearby, so check they're real and still happening."
      />
      <StatusTabs<Level>
        active={level}
        onChange={(v) => set({ level: v })}
        tabs={[
          { value: "live", label: "Live" },
          { value: "urgent", label: "Urgent" },
          { value: "resolved", label: "Resolved" },
          { value: "ended", label: "Ended" },
        ]}
      />
      <AdminToolbar count={countLabel(alerts.data, "alert")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search alerts" />
      </AdminToolbar>
      <DataTable
        page={alerts.data}
        loading={alerts.loading}
        refreshing={alerts.refreshing}
        error={alerts.error}
        onRetry={alerts.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(a) => a.id}
        rowHref={(a) => `/admin/posts/${a.id}`}
        primary={(a) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={a.level} />
              <span className="text-xs font-semibold text-muted-foreground capitalize">{a.alertCategory}</span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold">{a.message}</p>
          </div>
        )}
        columns={[
          { header: "Alert", className: "min-w-[280px]", cell: (a) => <span className="line-clamp-2">{a.message}</span> },
          { header: "Type", mobile: true, cell: (a) => <span className="capitalize">{a.alertCategory}</span> },
          { header: "Hood", mobile: true, cell: (a) => a.hood?.name ?? "—" },
          { header: "Posted by", cell: (a) => a.author.displayName },
          { header: "Status", cell: (a) => <StatusBadge status={a.level} /> },
          { header: "Posted", mobile: true, cell: (a) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(a.createdAt)}</span> },
        ]}
        actions={[
          { label: "Downgrade from urgent", hidden: (a) => a.level !== "urgent", onSelect: (a) => setPending({ action: "downgrade", alert: a }) },
          { label: "End alert", hidden: (a) => a.level !== "urgent" && a.level !== "active", onSelect: (a) => setPending({ action: "end", alert: a }) },
          { label: "Remove alert", destructive: true, onSelect: (a) => setPending({ action: "remove", alert: a }) },
        ]}
        empty={<EmptyBody icon={Siren} title={level === "live" ? "No live alerts" : "Nothing here"} description={level === "live" ? "All quiet across every Hood." : "Try another tab."} />}
      />
      {pending && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={SPEC[pending.action].title}
          consequence={SPEC[pending.action].consequence}
          reasons={SPEC[pending.action].reasons}
          destructive={SPEC[pending.action].destructive}
          confirmLabel={SPEC[pending.action].confirm}
          onConfirm={async ({ reason }) => {
            if (!user) return;
            await actOnAlert(user, pending.alert.id, { action: pending.action, reason }, role);
            toast.success("Alert updated");
            void alerts.refetch();
          }}
        />
      )}
    </div>
  );
}
