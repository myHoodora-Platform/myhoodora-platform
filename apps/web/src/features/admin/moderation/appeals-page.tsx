"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect } from "@/components/admin/admin-toolbar";
import { ActionDialog } from "@/components/admin/action-dialog";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { dateTimeLabel, timeAgo } from "@/components/admin/format";
import { useAuth } from "@/context/AuthContext";
import { decideAppeal, listAppeals } from "@/lib/api/admin/moderation";
import type { AdminAppeal } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";

const DECISION: Record<string, string> = {
  keep: "Kept",
  remove_content: "Removed",
  warn_author: "Warned",
  restrict_author: "Restricted",
  suspend_author: "Suspended",
};

/** What overturning means for this decision (shown before confirming). */
function overturnEffect(a: AdminAppeal): string {
  switch (a.decision.action) {
    case "remove_content":
      return `The ${a.target.type} is restored and ${a.by.displayName} is told.`;
    case "keep":
      return `The ${a.target.type} is removed and ${a.by.displayName} is told.`;
    case "restrict_author":
    case "suspend_author":
      return `${a.by.displayName}'s account is reinstated (admins only).`;
    default:
      return `The warning is withdrawn and ${a.by.displayName} is told.`;
  }
}

/**
 * Appeals on moderation decisions (Nextdoor: authors and reporters can
 * appeal). Reviewed by someone other than the original decider — the API
 * enforces that; this page just hides the buttons for them.
 */
export function AppealsPage() {
  const { user } = useAuth();
  const { session } = useAdminSession();
  const { get, set, page, key } = useListParams<"status">();
  const status = get("status") || "open";
  const appeals = useAdminQuery((u) => listAppeals(u, { status: status === "all" ? undefined : (status as AdminAppeal["status"]), page }), `${key}:${status}`);
  const [deciding, setDeciding] = useState<{ appeal: AdminAppeal; outcome: "upheld" | "overturned" } | null>(null);

  const actions = (a: AdminAppeal) => {
    if (a.status !== "open") return <StatusBadge status={a.status} />;
    if (a.decision.byUid === session?.uid) return <span className="text-xs text-muted-foreground">You made this decision</span>;
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setDeciding({ appeal: a, outcome: "upheld" })}>
          Uphold
        </Button>
        <Button size="sm" onClick={() => setDeciding({ appeal: a, outcome: "overturned" })}>
          Overturn
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Moderation" }, { label: "Appeals" }]}
        title="Appeals"
        description="Neighbours asking us to look again at a decision. Review each one fresh; you can't review your own decisions."
      />
      <AdminToolbar count={countLabel(appeals.data, "appeal")}>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => set({ status: v || "open" })}
          options={[
            { value: "open", label: "Waiting" },
            { value: "upheld", label: "Upheld" },
            { value: "overturned", label: "Overturned" },
            { value: "all", label: "All" },
          ]}
        />
      </AdminToolbar>
      <DataTable
        page={appeals.data}
        loading={appeals.loading}
        refreshing={appeals.refreshing}
        error={appeals.error}
        onRetry={appeals.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(a) => a.id}
        primary={(a) => (
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {a.by.displayName} · {a.party === "author" ? `appealing “${DECISION[a.decision.action] ?? a.decision.action}”` : "reporter asking us to remove it"}
            </p>
            <p className="line-clamp-2 text-sm text-muted-foreground">“{a.reason}”</p>
            {actions(a)}
          </div>
        )}
        columns={[
          {
            header: "Appeal",
            className: "min-w-[260px]",
            cell: (a) => (
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {a.by.displayName} <span className="font-normal text-muted-foreground">({a.party})</span>
                </p>
                <p className="line-clamp-3 text-muted-foreground">“{a.reason}”</p>
              </div>
            ),
          },
          {
            header: "Original decision",
            className: "min-w-[240px]",
            cell: (a) => (
              <div className="space-y-0.5">
                <p>
                  <span className="font-semibold">{DECISION[a.decision.action] ?? a.decision.action}</span> · {a.decision.reason}
                </p>
                <Link href={`/admin/moderation/reports/${a.caseId}`} className="line-clamp-1 text-primary hover:underline">
                  {a.target.type}: “{a.target.preview}”
                </Link>
              </div>
            ),
          },
          { header: "Filed", mobile: true, cell: (a) => <span className="whitespace-nowrap text-muted-foreground" title={dateTimeLabel(a.createdAt)}>{timeAgo(a.createdAt)}</span> },
          { header: "", cell: actions },
        ]}
        empty={<EmptyBody icon={Scale} title={status === "open" ? "No appeals waiting" : "No appeals match"} description="Appeals appear here when a neighbour asks us to look again." />}
      />

      {deciding && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={deciding.outcome === "overturned" ? "Overturn the decision" : "Uphold the decision"}
          consequence={deciding.outcome === "overturned" ? overturnEffect(deciding.appeal) : `The decision stands. ${deciding.appeal.by.displayName} is told your reason.`}
          reasons={
            deciding.outcome === "overturned"
              ? ["It follows the community guidelines", "We made a mistake", "The appeal gave us new context"]
              : ["It breaks the community guidelines", "The appeal doesn't change the decision"]
          }
          requireReason
          destructive={false}
          confirmLabel={deciding.outcome === "overturned" ? "Overturn" : "Uphold"}
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            // The appellant sees this, so the optional note is included.
            await decideAppeal(user, deciding.appeal.id, { outcome: deciding.outcome, reason: note ? `${reason}. ${note}`.slice(0, 500) : reason });
            toast.success(deciding.outcome === "overturned" ? "Decision overturned" : "Decision upheld");
            setDeciding(null);
            void appeals.refetch();
          }}
        />
      )}
    </div>
  );
}
