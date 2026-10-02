"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@myhoodora/ui/dropdown-menu";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton } from "@/components/admin/admin-states";
import { StatusTabs } from "@/components/admin/admin-toolbar";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { CATEGORY_LABEL, REASON_LABEL, dateLabel, dateTimeLabel, initials, timeAgo } from "@/components/admin/format";
import { getNeighbour } from "@/lib/api/admin/community";
import { listPosts } from "@/lib/api/admin/content";
import { listReports } from "@/lib/api/admin/moderation";
import type { NeighbourAction } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { reportHref } from "../moderation/queue-page";
import { NeighbourActionDialog } from "./neighbour-action";

type Tab = "activity" | "reports" | "verification" | "history";

const RESULT: Record<string, string> = {
  matched: "Matched a Hood",
  outside_coverage: "Outside our coverage",
  low_accuracy: "Location too imprecise",
  mismatch: "Pin didn't match the address",
};

export function NeighbourDetailPage({ uid }: { uid: string }) {
  const { can } = useAdminSession();
  const router = useRouter();
  const person = useAdminQuery((u) => getNeighbour(u, uid), uid);
  const posts = useAdminQuery((u) => listPosts(u, { authorUid: uid, pageSize: 20 }), `posts-${uid}`);
  const reports = useAdminQuery((u) => listReports(u, { authorUid: uid, status: "all", pageSize: 20 }), `reports-${uid}`);
  const [tab, setTab] = useState<Tab>("activity");
  const [action, setAction] = useState<NeighbourAction | null>(null);

  if (person.loading && !person.data) return <DetailSkeleton />;
  if (!person.data) return <AdminProblem error={person.error} onRetry={person.refetch} backHref="/admin/neighbours" />;
  const n = person.data;

  const primaryAction: { action: NeighbourAction; label: string } | null =
    n.verificationStatus !== "verified" && can("verification.review")
      ? { action: "verify", label: "Verify into Hood" }
      : n.accountStatus !== "active" && can("moderation.suspend")
        ? { action: "reinstate", label: "Reinstate" }
        : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Neighbours", href: "/admin/neighbours" }, { label: n.displayName }]}
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">{initials(n.displayName)}</span>
            {n.displayName}
          </span>
        }
        meta={
          <>
            <StatusBadge status={n.verificationStatus} />
            <StatusBadge status={n.accountStatus} label={n.accountStatus === "restricted" && n.restrictedUntil ? `Restricted until ${dateLabel(n.restrictedUntil)}` : undefined} />
            {n.role !== "member" && <StatusBadge status={n.role} />}
            {n.hood && (
              <Link href={`/admin/hoods/${n.hood.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">
                <MapPin className="size-3.5" aria-hidden /> {n.hood.name}
              </Link>
            )}
          </>
        }
        actions={
          <>
            {primaryAction && (
              <Button size="sm" onClick={() => setAction(primaryAction.action)}>
                {primaryAction.label}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted">
                More actions <ChevronDown className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {n.verificationStatus === "verified" && <DropdownMenuItem onSelect={() => setAction("change_hood")}>Move to another Hood</DropdownMenuItem>}
                {n.verificationStatus !== "verified" && n.verificationStatus !== "rejected" && can("verification.review") && (
                  <DropdownMenuItem onSelect={() => setAction("reject_verification")}>Reject verification</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => router.push(`/admin/inbox?new=${encodeURIComponent(n.uid)}`)}>Message</DropdownMenuItem>
                {can("broadcasts.send") && (
                  <DropdownMenuItem onSelect={() => router.push(`/admin/broadcasts?to=${encodeURIComponent(n.uid)}`)}>Send a notice</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setAction("warn")}>Send a warning</DropdownMenuItem>
                <DropdownMenuSeparator />
                {n.accountStatus === "active" && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setAction("restrict")}>
                    Restrict
                  </DropdownMenuItem>
                )}
                {n.accountStatus !== "suspended" && can("moderation.suspend") && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setAction("suspend")}>
                    Suspend
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <DetailLayout
        main={
          <>
            <StatusTabs<Tab>
              active={tab}
              onChange={setTab}
              tabs={[
                { value: "activity", label: "Posts", count: posts.data?.total },
                { value: "reports", label: "Reports against", count: reports.data?.total },
                { value: "verification", label: "Verification", count: n.verificationAttempts.length },
                { value: "history", label: "Staff history", count: n.timeline.length },
              ]}
            />
            {tab === "activity" && (
              <Panel padded={false}>
                {!posts.data?.items.length ? (
                  <p className="p-5 text-sm text-muted-foreground">No posts yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {posts.data.items.map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/posts/${p.id}`} className="block px-5 py-3.5 hover:bg-muted/40">
                          <p className="line-clamp-2 text-sm">{p.message}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {CATEGORY_LABEL[p.category] ?? p.category} · {timeAgo(p.createdAt)} · {p.reactions} reactions · {p.comments} comments
                            {p.status === "removed" && <StatusBadge status="removed" />}
                            {p.openReports > 0 && <StatusBadge status="escalated" label={`${p.openReports} open report`} />}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {tab === "reports" && (
              <Panel padded={false}>
                {!reports.data?.items.length ? (
                  <p className="p-5 text-sm text-muted-foreground">No one has reported {n.displayName.split(" ")[0]}&apos;s content.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {reports.data.items.map((r) => (
                      <li key={r.id}>
                        <Link href={reportHref(r)} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/40">
                          <StatusBadge status={r.severity} />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-sm">{r.target.preview}</span>
                            <span className="text-xs text-muted-foreground">
                              {REASON_LABEL[r.reasons[0]!.reason]} · {r.reporterCount} reports · {timeAgo(r.firstReportedAt)}
                            </span>
                          </span>
                          <StatusBadge status={r.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {tab === "verification" && (
              <Panel>
                {n.verificationAttempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Hasn&apos;t tried to verify an address yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {n.verificationAttempts.map((a, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                        <span>
                          <span className="block font-medium">{a.address}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.point.lat.toFixed(4)}, {a.point.lng.toFixed(4)} · {dateTimeLabel(a.at)}
                          </span>
                        </span>
                        <StatusBadge status={a.result === "matched" ? "verified" : "failed"} label={RESULT[a.result]} />
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            )}
            {tab === "history" && (
              <Panel>
                <Timeline events={n.timeline} empty="No staff actions on this account." />
              </Panel>
            )}
          </>
        }
        aside={
          <Panel title="Account">
            <KeyValues
              items={[
                { label: "Email", value: <span className="break-all">{n.email}</span> },
                { label: "Hood", value: n.hood?.name ?? "None yet" },
                { label: "Address", value: n.location?.address ?? "Not shared" },
                { label: "Joined", value: dateLabel(n.joinedAt) },
                { label: "Last active", value: n.lastActiveAt ? timeAgo(n.lastActiveAt) : "—" },
                { label: "Posts", value: n.counts.posts },
                { label: "Reports filed", value: n.counts.reportsFiled },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">Addresses are visible to staff only. Neighbours only ever see the Hood name.</p>
          </Panel>
        }
      />

      <NeighbourActionDialog
        action={action}
        targets={[{ uid: n.uid, displayName: n.displayName, hoodId: n.hood?.id }]}
        onClose={() => setAction(null)}
        onDone={() => void person.refetch()}
      />
    </div>
  );
}
