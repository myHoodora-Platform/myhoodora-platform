"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, Ban, CheckCircle2, EyeOff, Flag, MapPin, MessageSquareWarning, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton } from "@/components/admin/admin-states";
import { ActionDialog } from "@/components/admin/action-dialog";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { CATEGORY_LABEL, REASON_LABEL, dateTimeLabel, initials, naira, timeAgo } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { actOnReport, getReport, listReports, setReportClaim } from "@/lib/api/admin/moderation";
import type { ModerationAction, ReportDetail, ReportedContent } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { reportHref } from "./queue-page";

const VIOLATION_REASONS = ["Harassment or hate", "Scam or fraud", "Misinformation", "Spam or advertising", "Not about the neighbourhood", "Breaks community guidelines"];

interface ActionSpec {
  action: ModerationAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  reasons: string[];
  consequence: (r: ReportDetail) => React.ReactNode;
  adminOnly?: boolean;
  needsAuthor?: boolean;
  contentOnly?: boolean;
}

const ACTIONS: ActionSpec[] = [
  {
    action: "keep",
    label: "Keep, no violation",
    icon: CheckCircle2,
    reasons: ["No violation", "Disagreement, not a violation", "Duplicate report"],
    consequence: () => "The content stays up and the report is dismissed. Reporters are told it was reviewed. Nobody else is notified.",
  },
  {
    action: "remove_content",
    label: "Remove content",
    icon: Trash2,
    destructive: true,
    contentOnly: true,
    reasons: VIOLATION_REASONS,
    consequence: (r) => (
      <>
        The {r.target.type} is hidden from everyone{r.hood ? ` in ${r.hood.name}` : ""}.{" "}
        {r.author ? `${r.author.displayName} is told which guideline it broke, never who reported it.` : ""} You can restore it later.
      </>
    ),
  },
  {
    action: "warn_author",
    label: "Warn author",
    icon: MessageSquareWarning,
    needsAuthor: true,
    reasons: VIOLATION_REASONS,
    consequence: (r) => `${r.author?.displayName ?? "The author"} gets a private warning with the guideline. It's recorded on their history. Content is not removed unless you also remove it.`,
  },
  {
    action: "restrict_author",
    label: "Restrict author",
    icon: ShieldAlert,
    destructive: true,
    needsAuthor: true,
    reasons: ["Repeated violations", "Harassment", "Scam attempts", "Spam"],
    consequence: (r) => `${r.author?.displayName ?? "The author"} can still read and message, but can't post, comment or list items until the restriction ends.`,
  },
  {
    action: "suspend_author",
    label: "Suspend account",
    icon: Ban,
    destructive: true,
    needsAuthor: true,
    adminOnly: true,
    reasons: ["Scam or fraud", "Serious harassment or threats", "Impersonation", "Repeated violations after restriction"],
    consequence: (r) => `${r.author?.displayName ?? "The author"} is signed out and can't use myHoodora until an admin reinstates them.`,
  },
  {
    action: "escalate",
    label: "Escalate to admin",
    icon: Flag,
    reasons: ["Needs an admin decision", "Possible legal issue", "Threat to safety"],
    consequence: () => "The report moves to the Escalated tab for an admin. Your notes go with it.",
  },
];

export function ReportDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  // Live: another moderator claiming or deciding it shows straight away.
  const report = useAdminQuery((u) => getReport(u, id), id, ["queue.changed"]);
  const [open, setOpen] = useState<ActionSpec | null>(null);
  const [days, setDays] = useState("7");
  const [claiming, setClaiming] = useState(false);

  if (report.loading && !report.data) return <DetailSkeleton />;
  if (!report.data) return <AdminProblem error={report.error} onRetry={report.refetch} backHref="/admin/moderation" />;
  const r = report.data;
  const closed = r.status === "resolved" || r.status === "dismissed";
  const mine = r.assignee?.uid === user?.uid;
  const available = ACTIONS.filter(
    (a) => (!a.adminOnly || can("moderation.suspend")) && (!a.needsAuthor || r.author) && (!a.contentOnly || !("removed" in r.content) || !r.content.removed),
  ).filter((a) => !(r.target.type === "user" && a.action === "remove_content"));

  const claim = async (on: boolean) => {
    if (!user) return;
    setClaiming(true);
    try {
      await setReportClaim(user, id, on, role);
      await report.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update.");
    } finally {
      setClaiming(false);
    }
  };

  const goNext = async () => {
    if (!user) return;
    const next = (await listReports(user, { status: "active", pageSize: 5 })).items.find((x) => x.id !== id);
    router.push(next ? reportHref(next) : "/admin/moderation");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Moderation" }, { label: "Queue", href: "/admin/moderation" }, { label: "Report" }]}
        title={`Reported ${r.target.type === "user" ? "account" : r.target.type}${r.author ? ` by ${r.author.displayName}` : ""}`}
        meta={
          <>
            <StatusBadge status={r.severity} label={`${r.severity[0]!.toUpperCase()}${r.severity.slice(1)} severity`} />
            <StatusBadge status={r.status} label={r.status === "under_review" && r.assignee ? `${mine ? "You're" : `${r.assignee.displayName} is`} reviewing` : undefined} />
            <span className="text-xs text-muted-foreground">
              First reported {timeAgo(r.firstReportedAt)} · {r.reporterCount} {r.reporterCount === 1 ? "neighbour" : "neighbours"}
            </span>
          </>
        }
        actions={
          !closed &&
          (mine ? (
            <Button variant="outline" size="sm" onClick={() => void claim(false)} loading={claiming}>
              Release
            </Button>
          ) : !r.assignee ? (
            <Button variant="outline" size="sm" onClick={() => void claim(true)} loading={claiming}>
              Start reviewing
            </Button>
          ) : null)
        }
      />

      <DetailLayout
        main={
          <>
            {(r.route === "leads" || r.leadVotes) && (
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
                <p className="font-semibold">{r.route === "leads" ? "Hood Leads are voting on this" : "Hood Leads voted on this"}</p>
                <p className="text-muted-foreground">
                  {r.leadVotes
                    ? `${r.leadVotes.total} ${r.leadVotes.total === 1 ? "vote" : "votes"}: ${r.leadVotes.remove} remove · ${r.leadVotes.maybe_remove} not sure · ${r.leadVotes.keep} keep.`
                    : "No votes yet."}{" "}
                  {r.route === "leads" && "You can still decide now; otherwise it comes to staff after 48 hours without agreement."}
                </p>
              </div>
            )}
            <Panel title="What was reported">
              <ContentPreview content={r.content} author={r.author?.displayName} hood={r.hood?.name} />
            </Panel>

            <Panel title={`Why it was reported (${r.reports.length})`}>
              <div className="mb-4 flex flex-wrap gap-2">
                {r.reasons.map((x) => (
                  <span key={x.reason} className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                    {REASON_LABEL[x.reason]} <span className="text-muted-foreground">×{x.count}</span>
                  </span>
                ))}
              </div>
              <ul className="space-y-3">
                {r.reports.map((x, i) => (
                  <li key={i} className="rounded-xl border border-border p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{x.reporter.displayName}</span>· {REASON_LABEL[x.reason]} · {timeAgo(x.at)}
                    </p>
                    {x.details && <p className="mt-1">“{x.details}”</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="size-3.5" aria-hidden /> Reporters are visible to staff only and never shown to the author.
              </p>
            </Panel>

            {closed && r.resolution ? (
              <Panel title="Decision">
                <p className="text-sm">
                  <span className="font-semibold">{r.resolution.by}</span> chose <span className="font-semibold">{ACTIONS.find((a) => a.action === r.resolution!.action)?.label.toLowerCase()}</span>{" "}
                  · {r.resolution.reason} · {timeAgo(r.resolution.at)}
                </p>
                {r.resolution.note && <p className="mt-1 text-sm text-muted-foreground">“{r.resolution.note}”</p>}
              </Panel>
            ) : (
              <Panel title="Decide">
                {r.assignee && !mine && (
                  <p className="mb-3 rounded-xl bg-muted p-3 text-sm">
                    {r.assignee.displayName} is already reviewing this. You can still act, but check with them first.
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {available.map((a) => (
                    <button
                      key={a.action}
                      type="button"
                      onClick={() => setOpen(a)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                        a.destructive ? "border-destructive/25 text-destructive hover:bg-danger-soft/50" : "border-border hover:bg-muted/60",
                      )}
                    >
                      <a.icon className="size-4 shrink-0" />
                      {a.label}
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </>
        }
        aside={
          <>
            {r.author && (
              <Panel
                title="Author"
                action={
                  <Link href={`/admin/neighbours/${r.author.uid}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                    Profile <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                }
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials(r.author.displayName)}</span>
                  <div>
                    <p className="font-semibold">{r.author.displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.author.role}</p>
                  </div>
                </div>
                <KeyValues
                  items={[
                    { label: "Hood", value: r.author.hood?.name ?? "None" },
                    { label: "Verification", value: <StatusBadge status={r.author.verificationStatus} /> },
                    { label: "Account", value: <StatusBadge status={r.author.accountStatus} /> },
                    { label: "Past staff actions", value: r.author.priorActions.length },
                    { label: "Other open reports", value: r.related.filter((x) => x.status !== "resolved" && x.status !== "dismissed").length },
                  ]}
                />
              </Panel>
            )}
            {r.hood && (
              <Panel title="Hood">
                <Link href={`/admin/hoods/${r.hood.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-primary">
                  <MapPin className="size-4 text-primary" aria-hidden /> {r.hood.name}, {r.hood.city}
                </Link>
              </Panel>
            )}
            {r.related.length > 0 && (
              <Panel title="Other reports about this author" padded={false}>
                <ul className="divide-y divide-border">
                  {r.related.map((x) => (
                    <li key={x.id}>
                      <Link href={reportHref(x)} className="flex items-center gap-2 px-5 py-3 text-sm hover:bg-muted/40">
                        <span className="line-clamp-1 flex-1">{x.target.preview}</span>
                        <StatusBadge status={x.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <Panel title="History">
              <Timeline events={[...r.timeline, ...(r.author?.priorActions ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)} empty="No staff actions yet." />
            </Panel>
          </>
        }
      />

      {open && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={open.label}
          consequence={open.consequence(r)}
          reasons={open.reasons}
          destructive={open.destructive}
          confirmLabel={open.label}
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            await actOnReport(user, id, { action: open.action, reason, note, restrictDays: open.action === "restrict_author" ? Number(days) : undefined }, role);
            toast.success(open.action === "keep" ? "Report dismissed" : open.action === "escalate" ? "Escalated to an admin" : "Done. The decision is logged.");
            await goNext();
          }}
        >
          {open.action === "restrict_author" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">For how long?</span>
              <select value={days} onChange={(e) => setDays(e.target.value)} className={fieldInputClass}>
                {["1", "3", "7", ...(can("moderation.suspend") ? ["14", "30"] : [])].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === "1" ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </ActionDialog>
      )}
    </div>
  );
}

/** Content shown the way neighbours saw it, so decisions have context. */
function ContentPreview({ content, author, hood }: { content: ReportedContent; author?: string; hood?: string }) {
  const [reveal, setReveal] = useState(false);
  if (content.kind === "other") return <p className="text-sm text-muted-foreground">{content.label}</p>;
  if (content.kind === "user") {
    return (
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{initials(content.displayName)}</span>
        <div>
          <p className="font-semibold">{content.displayName}</p>
          <p className="text-sm text-muted-foreground">{content.bio ? `“${content.bio}”` : "No bio"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Account reports are always reviewed by staff, never by volunteers.</p>
        </div>
      </div>
    );
  }
  const removed = content.removed;
  return (
    <div className={cn("rounded-2xl border border-border bg-canvas p-4", removed && "opacity-70")}>
      {removed && <p className="mb-3 inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">Removed, hidden from neighbours</p>}
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(author ?? "?")}</span>
        <div className="text-sm">
          <p className="font-semibold">{author ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            {hood ?? ""}
            {"createdAt" in content ? ` · ${dateTimeLabel(content.createdAt)}` : ""}
            {content.kind === "post" ? ` · ${CATEGORY_LABEL[content.category] ?? content.category}` : ""}
          </p>
        </div>
      </div>
      {content.kind === "comment" && (
        <p className="mt-3 rounded-lg border-l-4 border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Replying to: “{content.onPost.message.slice(0, 140)}”
        </p>
      )}
      {content.kind === "listing" ? (
        <div className="mt-3">
          <p className="font-bold">{content.title}</p>
          <p className="text-sm font-semibold text-primary">{naira(content.priceNaira)}</p>
          <p className="mt-1 text-sm">{content.description}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{content.message}</p>
      )}
      {content.kind === "post" && content.media.length > 0 && (
        <button type="button" onClick={() => setReveal(true)} className="relative mt-3 block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- moderation preview of user media */}
          <img src={content.media[0]} alt="Attached media" className={cn("max-h-64 w-full object-cover", !reveal && "blur-xl")} />
          {!reveal && <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">Tap to reveal media</span>}
        </button>
      )}
    </div>
  );
}
