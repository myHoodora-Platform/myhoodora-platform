"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Phone, XCircle } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton, Unauthorized } from "@/components/admin/admin-states";
import { ActionDialog } from "@/components/admin/action-dialog";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { dateLabel } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { actOnBusiness, getBusiness, type BusinessAction } from "@/lib/api/admin/businesses";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

const SPEC: Record<BusinessAction, { title: string; confirm: string; destructive?: boolean; reasons: string[]; consequence: (name: string) => string; message?: boolean }> = {
  approve: {
    title: "Approve Business Page",
    confirm: "Approve",
    reasons: ["Details check out", "CAC number matched", "Phone verified"],
    consequence: (n) => `${n} gets a verified Business Page and the owner is emailed a link to claim it and start posting to the areas they serve.`,
  },
  request_info: {
    title: "Ask for more information",
    confirm: "Send request",
    reasons: ["Unclear what the business offers", "CAC number didn't match", "Phone couldn't be verified", "Areas served look too wide"],
    consequence: (n) => `The owner of ${n} gets an email with your message. The application stays open.`,
    message: true,
  },
  reject: {
    title: "Reject application",
    confirm: "Reject",
    destructive: true,
    reasons: ["Not a local business", "Prohibited goods or services", "Duplicate application", "Suspected fraud"],
    consequence: (n) => `${n} won't get a page. The owner is told why and can reapply if things change.`,
    message: true,
  },
  suspend: {
    title: "Suspend Business Page",
    confirm: "Suspend",
    destructive: true,
    reasons: ["Scam reports from neighbours", "Misleading posts", "Owner asked us to"],
    consequence: (n) => `${n}'s page and posts are hidden from neighbours until an admin reinstates it.`,
  },
  reinstate: {
    title: "Reinstate Business Page",
    confirm: "Reinstate",
    reasons: ["Issue resolved", "Appeal accepted"],
    consequence: (n) => `${n}'s page and posts become visible again.`,
  },
};

const CHECK_ICON = { verified: CheckCircle2, matched: CheckCircle2, pending: Clock, failed: XCircle, mismatch: XCircle, not_provided: Clock } as const;

export function BusinessDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const biz = useAdminQuery((u) => getBusiness(u, id), id);
  const [action, setAction] = useState<BusinessAction | null>(null);
  const [message, setMessage] = useState("");

  if (!can("businesses.review")) return <Unauthorized message="Business approvals are handled by admins." />;
  if (biz.loading && !biz.data) return <DetailSkeleton />;
  if (!biz.data) return <AdminProblem error={biz.error} onRetry={biz.refetch} backHref="/admin/businesses" />;
  const b = biz.data;
  const open = b.status === "applied" || b.status === "info_requested";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Businesses", href: "/admin/businesses" }, { label: b.name }]}
        title={b.name}
        description={b.description}
        meta={
          <>
            <StatusBadge status={b.status} />
            <span className="text-xs text-muted-foreground">
              {b.category} · applied {dateLabel(b.appliedAt)}
            </span>
          </>
        }
        actions={
          open ? (
            <>
              <Button size="sm" onClick={() => setAction("approve")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAction("request_info")}>
                Ask for info
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setAction("reject")}>
                Reject
              </Button>
            </>
          ) : b.status === "verified" ? (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setAction("suspend")}>
              Suspend page
            </Button>
          ) : b.status === "suspended" ? (
            <Button size="sm" onClick={() => setAction("reinstate")}>
              Reinstate
            </Button>
          ) : null
        }
      />

      <DetailLayout
        main={
          <>
            <Panel title="Checks">
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Phone (OTP)", b.checks.phone, b.checks.phone === "verified" ? "Owner confirmed the number" : "Waiting for the owner to confirm the code"],
                  ["CAC registration", b.checks.cac, b.checks.cac === "not_provided" ? "Not registered yet. That's allowed for small traders." : b.checks.cac === "matched" ? "Matches CAC public search" : "Checking CAC public search"],
                ].map(([label, state, hint]) => {
                  const Icon = CHECK_ICON[state as keyof typeof CHECK_ICON];
                  const good = state === "verified" || state === "matched";
                  return (
                    <li key={label} className="flex gap-3 rounded-xl border border-border p-4">
                      <Icon className={`mt-0.5 size-5 shrink-0 ${good ? "text-emerald-600" : "text-amber-600"}`} aria-hidden />
                      <span>
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            <Panel title="Areas served">
              <div className="flex flex-wrap gap-2">
                {b.areasServed.map((a) => (
                  <span key={a} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    {a}
                  </span>
                ))}
              </div>
            </Panel>
            <Panel title="History">
              <Timeline events={b.timeline} empty="No decisions yet." />
            </Panel>
          </>
        }
        aside={
          <Panel title="Owner & details">
            <KeyValues
              items={[
                { label: "Contact", value: b.owner.name },
                { label: "Phone", value: <a href={`tel:${b.owner.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="size-3.5" aria-hidden />{b.owner.phone}</a> },
                { label: "Email", value: <span className="break-all">{b.owner.email}</span> },
                { label: "CAC number", value: b.cacNumber ?? "Not given" },
                { label: "Address", value: b.address ?? "Goes to customers" },
                { label: "Local Ads waitlist", value: b.wantsAdsUpdates ? "Yes" : "No" },
              ]}
            />
          </Panel>
        }
      />

      {action && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && (setAction(null), setMessage(""))}
          title={SPEC[action].title}
          consequence={SPEC[action].consequence(b.name)}
          reasons={SPEC[action].reasons}
          destructive={SPEC[action].destructive}
          confirmLabel={SPEC[action].confirm}
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            const next = await actOnBusiness(user, id, { action, reason, message: message.trim() || note }, role);
            biz.setData(next);
            setMessage("");
            toast.success(`${SPEC[action].confirm}: done`);
          }}
        >
          {SPEC[action].message && (
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Message to the owner</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={fieldInputClass} placeholder="Hi, thanks for applying. Could you…" />
            </label>
          )}
        </ActionDialog>
      )}
    </div>
  );
}
