"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton } from "@/components/admin/admin-states";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Timeline } from "@/components/admin/timeline";
import { CATEGORY_LABEL, REASON_LABEL, dateTimeLabel, initials, timeAgo } from "@/components/admin/format";
import { getPost } from "@/lib/api/admin/content";
import { useAdminQuery } from "../use-admin-query";
import { reportHref } from "../moderation/queue-page";
import { ContentActionDialog, type ContentTarget } from "./content-action";

export function PostDetailPage({ id }: { id: string }) {
  const post = useAdminQuery((u) => getPost(u, id), id);
  const [target, setTarget] = useState<ContentTarget | null>(null);

  if (post.loading && !post.data) return <DetailSkeleton />;
  if (!post.data) return <AdminProblem error={post.error} onRetry={post.refetch} backHref="/admin/posts" />;
  const p = post.data;
  const removed = p.status === "removed";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Posts", href: "/admin/posts" }, { label: "Post" }]}
        title={`${CATEGORY_LABEL[p.category] ?? "Post"} by ${p.author.displayName}`}
        meta={
          <>
            <StatusBadge status={p.status} />
            {p.urgent && <StatusBadge status="urgent" />}
            {p.openReports > 0 && <StatusBadge status="escalated" label={`${p.openReports} open report${p.openReports > 1 ? "s" : ""}`} />}
            <span className="text-xs text-muted-foreground">{dateTimeLabel(p.createdAt)}</span>
          </>
        }
        actions={
          removed ? (
            <Button size="sm" variant="outline" onClick={() => setTarget({ type: "post", id: p.id, label: p.message.slice(0, 60), action: "restore" })}>
              Restore post
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setTarget({ type: "post", id: p.id, label: p.message.slice(0, 60), action: "remove" })}>
              Remove post
            </Button>
          )
        }
      />

      <DetailLayout
        main={
          <>
            {/* Rendered like the feed so moderation has real context */}
            <Panel title="As neighbours see it">
              <article className={cn("rounded-2xl border border-border bg-canvas p-4", removed && "opacity-60")}>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials(p.author.displayName)}</span>
                  <div className="text-sm">
                    <p className="font-semibold">{p.author.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.hood?.name} · {timeAgo(p.createdAt)} · {CATEGORY_LABEL[p.category] ?? p.category}
                      {p.alertCategory ? ` · ${p.alertCategory}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{p.message}</p>
                {p.media.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element -- user media preview
                  <img src={p.media[0]} alt="" className="mt-3 max-h-72 w-full rounded-xl object-cover" />
                )}
                <p className="mt-3 flex gap-4 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" aria-hidden /> {p.reactions}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="size-3.5" aria-hidden /> {p.comments}
                  </span>
                </p>
              </article>
            </Panel>

            <Panel title={`Comments (${p.commentsList.length})`} padded={false}>
              {p.commentsList.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No comments.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {p.commentsList.map((c) => {
                    const reported = p.reports.some((r) => r.target.type === "comment" && r.target.id === c.id && r.status !== "resolved" && r.status !== "dismissed");
                    return (
                      <li key={c.id} className={cn("flex gap-3 px-5 py-3.5", c.status === "removed" && "opacity-60")}>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{initials(c.author.displayName)}</span>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/neighbours/${c.author.uid}`} className="font-semibold hover:underline">
                              {c.author.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                            {c.status === "removed" && <StatusBadge status="removed" />}
                            {reported && <StatusBadge status="escalated" label="Reported" />}
                          </p>
                          <p className="mt-0.5">{c.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTarget({ type: "comment", id: c.id, label: c.message.slice(0, 60), action: c.status === "removed" ? "restore" : "remove" })}
                          className={cn("shrink-0 self-start text-xs font-semibold hover:underline", c.status === "removed" ? "text-primary" : "text-destructive")}
                        >
                          {c.status === "removed" ? "Restore" : "Remove"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        }
        aside={
          <>
            <Panel
              title="Author"
              action={
                <Link href={`/admin/neighbours/${p.author.uid}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Profile <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              }
            >
              <KeyValues
                items={[
                  { label: "Name", value: p.author.displayName },
                  { label: "Hood", value: p.hood ? <Link href={`/admin/hoods/${p.hood.id}`} className="hover:text-primary hover:underline">{p.hood.name}</Link> : "—" },
                ]}
              />
            </Panel>
            <Panel title={`Reports (${p.reports.length})`} padded={false}>
              {p.reports.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Nobody has reported this post or its comments.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {p.reports.map((r) => (
                    <li key={r.id}>
                      <Link href={reportHref(r)} className="flex items-center gap-2 px-5 py-3 text-sm hover:bg-muted/40">
                        <span className="flex-1">
                          {r.target.type === "comment" ? "Comment · " : ""}
                          {REASON_LABEL[r.reasons[0]!.reason]} ×{r.reporterCount}
                        </span>
                        <StatusBadge status={r.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="History">
              <Timeline events={p.timeline} empty="No staff actions on this post." />
            </Panel>
          </>
        }
      />
      <ContentActionDialog target={target} onClose={() => setTarget(null)} onDone={() => void post.refetch()} />
    </div>
  );
}
