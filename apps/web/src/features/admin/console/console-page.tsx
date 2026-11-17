"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, MessageCircleReply, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { listHoods } from "@/lib/api/admin/community";
import { consoleReply, getAssignments, getConsoleStats, getNeedsReply, setAssignment, type NeedsReplyItem } from "@/lib/api/admin/console";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

const waited = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`);

/**
 * The moderator console (plan WP-B): posts nobody has answered (newcomers' first posts first: a reply
 * within two hours is what makes them stay), answered from here as yourself or as the Hood Team; reply
 * times; and who looks after which Hoods. Refreshes every minute.
 */
export function ConsolePage() {
  const { can } = useAdminSession();
  const [mine, setMine] = useState(false);
  const list = useAdminQuery((u) => getNeedsReply(u, mine), `needs-reply:${mine}`);
  const stats = useAdminQuery((u) => getConsoleStats(u), "console-stats");
  const refetch = useRef(list.refetch);
  refetch.current = list.refetch;
  useEffect(() => {
    const id = setInterval(() => void refetch.current(), 60_000);
    return () => clearInterval(id);
  }, []);

  const done = (postId: string) => {
    if (list.data) list.setData({ ...list.data, items: list.data.items.filter((i) => i.postId !== postId), waiting: list.data.waiting - 1 });
    void stats.refetch();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Needs a reply" description="Posts nobody has answered in the last three days. Reply to a newcomer's first post within two hours (07:00–22:00): it's what makes them stay." />

      {stats.data && (
        <dl className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ["Waiting now", list.data?.waiting ?? "—"],
              ["Over two hours", list.data?.overdue ?? "—"],
              ["Replied (7 days)", stats.data.posts ? `${Math.round((stats.data.replied / stats.data.posts) * 100)}%` : "—"],
              ["Median first reply", stats.data.medianMinutesToFirstReply === null ? "—" : waited(stats.data.medianMinutesToFirstReply)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div role="tablist" aria-label="Which posts" className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold">
        {(
          [
            [false, "All Hoods"],
            [true, `My Hoods${list.data?.myHoods ? ` (${list.data.myHoods})` : ""}`],
          ] as const
        ).map(([value, label]) => (
          <button key={label} type="button" role="tab" aria-selected={mine === value} onClick={() => setMine(value)} className={cn("rounded-full px-4 py-1.5", mine === value ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {list.error && !list.data ? (
        <AdminProblem error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" />
      ) : list.data.items.length === 0 ? (
        <EmptyBody icon={MessageCircleReply} title="Everyone has a reply" description={mine && !list.data.myHoods ? "You haven't been given any Hoods yet. An admin can assign some below." : "Nothing waiting. Nice work."} />
      ) : (
        <ul className="space-y-3">
          {list.data.items.map((item) => (
            <WaitingPost key={item.postId} item={item} onDone={() => done(item.postId)} />
          ))}
        </ul>
      )}

      {stats.data && stats.data.firstRepliesByStaff.length > 0 && (
        <Panel title="First replies this week">
          <ul className="divide-y divide-border text-sm">
            {stats.data.firstRepliesByStaff.map((s) => (
              <li key={s.uid} className="flex justify-between py-2">
                <span>{s.displayName}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AssignmentsPanel editable={can("team.manage")} />
    </div>
  );
}

function WaitingPost({ item, onDone }: { item: NeedsReplyItem; onDone: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [as, setAs] = useState<"self" | "team">(item.firstPost && item.author.newcomer ? "team" : "self");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      await consoleReply(user, item.postId, text.trim(), as);
      toast.success(as === "team" ? "Replied as the Hood Team." : "Replied.");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <li className={cn("rounded-2xl border bg-card p-4", item.overdue ? "border-amber-400/70" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">{item.hood.name}</span>
        {item.firstPost && item.author.newcomer && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            <Sparkles className="size-3" aria-hidden /> Newcomer&apos;s first post
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1", item.overdue ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
          <Clock className="size-3" aria-hidden /> waiting {waited(item.waitingMinutes)}
        </span>
      </div>
      <p className="mt-2 text-sm">
        <Link href={`/admin/neighbours/${item.author.uid}`} className="font-semibold hover:underline">
          {item.author.displayName}
        </Link>
        : {item.excerpt}{" "}
        <Link href={`/p/${item.postId}`} target="_blank" className="text-primary hover:underline">
          Open
        </Link>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor={`reply-${item.postId}`}>
          Reply
        </label>
        <textarea id={`reply-${item.postId}`} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={item.firstPost && item.author.newcomer ? "Welcome them, and ask a question back…" : "Write a reply…"} className="min-h-[44px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex items-center gap-2">
          <select aria-label="Reply as" value={as} onChange={(e) => setAs(e.target.value as "self" | "team")} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
            <option value="self">As me (Staff)</option>
            <option value="team">As the Hood Team</option>
          </select>
          <Button onClick={() => void send()} disabled={sending || !text.trim()}>
            {sending ? "Sending…" : "Reply"}
          </Button>
        </div>
      </div>
    </li>
  );
}

function AssignmentsPanel({ editable }: { editable: boolean }) {
  const { user } = useAuth();
  const assignments = useAdminQuery((u) => getAssignments(u), "assignments");
  const hoods = useAdminQuery((u) => listHoods(u, { pageSize: 500 } as never), "assign-hoods");
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  if (!assignments.data) return null;
  const save = async (uid: string) => {
    if (!user) return;
    try {
      assignments.setData(await setAssignment(user, uid, [...picked]));
      toast.success("Hoods saved.");
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Panel title="Who looks after which Hoods">
      <ul className="divide-y divide-border text-sm">
        {assignments.data.staff.map((s) => (
          <li key={s.uid} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold">
                <UserRound className="size-4 text-muted-foreground" aria-hidden /> {s.displayName} <span className="text-xs font-normal text-muted-foreground">{s.role}</span>
              </span>
              {editable && editing !== s.uid && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(s.uid);
                    setPicked(new Set(s.hoods.map((h) => h.id)));
                  }}
                >
                  Change Hoods
                </Button>
              )}
            </div>
            {editing === s.uid ? (
              <div className="mt-2 space-y-2">
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a Hood" className="h-9 w-full rounded-lg border border-border bg-background px-3" />
                <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                  {(hoods.data?.items ?? [])
                    .filter((h) => !filter || h.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((h) => (
                      <label key={h.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={picked.has(h.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(h.id);
                            else next.delete(h.id);
                            setPicked(next);
                          }}
                        />
                        {h.name}
                      </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void save(s.uid)}>
                    Save ({picked.size})
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{s.hoods.length ? s.hoods.map((h) => h.name).join(" · ") : "No Hoods yet"}</p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
