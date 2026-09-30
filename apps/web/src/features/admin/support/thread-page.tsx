"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, DetailSkeleton } from "@/components/admin/admin-states";
import { DetailLayout, KeyValues, Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { dateTimeLabel, initials, timeAgo } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getThread, replyToThread, updateThread } from "@/lib/api/admin/support";
import type { InboxStatus } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { SOURCE_LABEL } from "./inbox-page";

const SAVED_REPLIES = [
  "Thanks for reaching out. We're looking into this and will get back to you shortly.",
  "Could you share a screenshot, and the name of your street or estate? That helps us check faster.",
  "This should be fixed now. Please try again and let us know if anything still looks wrong.",
];

export function ThreadPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { role } = useAdminSession();
  // Live: the neighbour's replies (and other staff's actions) appear without a reload.
  const thread = useAdminQuery((u) => getThread(u, id), id, ["inbox.updated"]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<null | "reply" | "resolve">(null);

  if (thread.loading && !thread.data) return <DetailSkeleton />;
  if (!thread.data) return <AdminProblem error={thread.error} onRetry={thread.refetch} backHref="/admin/inbox" />;
  const t = thread.data;

  const send = async (resolve: boolean) => {
    if (!user || !reply.trim()) return;
    setBusy(resolve ? "resolve" : "reply");
    try {
      thread.setData(await replyToThread(user, id, reply.trim(), role, resolve));
      setReply("");
      toast.success(resolve ? "Replied and resolved" : "Reply sent");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your reply."));
    } finally {
      setBusy(null);
    }
  };

  const patch = async (p: Parameters<typeof updateThread>[2]) => {
    if (!user) return;
    try {
      thread.setData(await updateThread(user, id, p, role));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update."));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Support" }, { label: "Inbox", href: "/admin/inbox" }, { label: t.subject }]}
        title={t.subject}
        meta={
          <>
            <StatusBadge status={t.status} />
            <span className="text-xs text-muted-foreground">
              {SOURCE_LABEL[t.source]} · opened {timeAgo(t.createdAt)}
            </span>
          </>
        }
      />
      <DetailLayout
        main={
          <>
            <Panel title="Conversation">
              <ol className="space-y-4">
                {t.messages.map((m, i) => (
                  <li key={i} className={cn("flex gap-3", m.from === "staff" && "flex-row-reverse")}>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", m.from === "staff" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {initials(m.from === "staff" ? (m.by ?? "Staff") : t.from.name)}
                    </span>
                    <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm", m.from === "staff" ? "bg-primary/10" : "bg-muted")}>
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.from === "staff" ? m.by : t.from.name} · {dateTimeLabel(m.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title={t.status === "resolved" ? "Reply (reopens the conversation)" : "Reply"}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {SAVED_REPLIES.map((r) => (
                      <button key={r} type="button" onClick={() => setReply(r)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">
                        {r.slice(0, 32)}…
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    className={fieldInputClass}
                    placeholder={`Reply to ${t.from.name.split(" ")[0]}. They'll get it by ${t.from.uid ? "in-app notification and email" : "email"}.`}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => void send(false)} disabled={!reply.trim() || busy !== null} loading={busy === "reply"}>
                      Send reply
                    </Button>
                    <Button onClick={() => void send(true)} disabled={!reply.trim() || busy !== null} loading={busy === "resolve"}>
                      Send &amp; resolve
                    </Button>
                  </div>
                </div>
            </Panel>
          </>
        }
        aside={
          <>
            <Panel
              title="From"
              action={
                t.from.uid && (
                  <Link href={`/admin/neighbours/${t.from.uid}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                    Profile <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                )
              }
            >
              <KeyValues
                items={[
                  { label: "Name", value: t.from.name },
                  { label: "Email", value: <span className="break-all">{t.from.email || "—"}</span> },
                  { label: "Topic", value: <span className="capitalize">{t.topic.replace(/_/g, " ")}</span> },
                ]}
              />
            </Panel>
            <Panel title="Manage">
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Status</span>
                  <select value={t.status} onChange={(e) => void patch({ status: e.target.value as InboxStatus })} className={fieldInputClass}>
                    <option value="open">Needs a reply</option>
                    <option value="waiting">Waiting on neighbour</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Priority</span>
                  <select value={t.priority} onChange={(e) => void patch({ priority: e.target.value as typeof t.priority })} className={fieldInputClass}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <p className="text-sm">
                  {t.assignee ? (
                    <>
                      Assigned to <span className="font-semibold">{t.assignee.displayName}</span>
                    </>
                  ) : (
                    <button type="button" onClick={() => void patch({ assignToMe: true })} className="font-semibold text-primary hover:underline">
                      Assign to me
                    </button>
                  )}
                </p>
              </div>
            </Panel>
          </>
        }
      />
    </div>
  );
}
