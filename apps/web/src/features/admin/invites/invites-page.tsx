"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Download, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { BUILDER_INVITES, INVITE_FLAG_LABELS } from "@myhoodora/api-contract/invites";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { downloadInviteCsv, getInviteFlags, getInviteLeaderboard } from "@/lib/api/admin/invites";
import { dateLabel } from "@/components/admin/format";
import { useAdminQuery } from "../use-admin-query";

/** When the launch challenge began (17 Nov 2026, WAT): the board counts from here unless changed. */
const CHALLENGE_START = "2026-11-17";
const toIso = (day: string) => (day ? new Date(`${day}T00:00:00+01:00`).toISOString() : undefined);

/**
 * The launch challenge's invite leaderboard (plan WP-E/WP-F): who brought the most neighbours, and
 * which Hoods are growing. Only invitees who verified their address count. CSV for the offline team.
 */
export function InvitesLeaderboardPage() {
  const { user } = useAuth();
  const [since, setSince] = useState(CHALLENGE_START);
  const query = { from: toIso(since) };
  const board = useAdminQuery((u) => getInviteLeaderboard(u, query), `invites:${since}`);
  const flags = useAdminQuery((u) => getInviteFlags(u), "invite-flags");
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!user) return;
    setDownloading(true);
    try {
      await downloadInviteCsv(user, query);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Invites"
        description="Who is bringing neighbours in. An invite counts once the person verifies their address and passes the age check."
        actions={
          <Button variant="outline" onClick={() => void download()} disabled={downloading || !board.data}>
            <Download className="size-4" aria-hidden /> {downloading ? "Preparing…" : "Download CSV"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Invites made since" htmlFor="invites-since" hint="The challenge began on 17 Nov.">
          <input id="invites-since" type="date" value={since} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setSince(e.target.value)} className={fieldInputClass} />
        </Field>
        {board.data && (
          <dl className="flex gap-6 pb-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Joined with a code</dt>
              <dd className="text-2xl font-bold">{board.data.totals.joined.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Verified (counted)</dt>
              <dd className="text-2xl font-bold text-primary">{board.data.totals.verified.toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </div>

      {flags.data && flags.data.length > 0 && (
        <Panel title={`Needs a look (${flags.data.reduce((n, g) => n + g.invitees.length, 0)})`}>
          <p className="mb-3 text-sm text-muted-foreground">
            Invites that look like one person. They still count until you remove the credit; open a neighbour to decide. An estate&apos;s shared Wi-Fi can be fine.
          </p>
          <ul className="space-y-3">
            {flags.data.map((g) => (
              <li key={g.inviter.uid} className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/5">
                <p className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-700 dark:text-amber-300" aria-hidden />
                  <Link href={`/admin/neighbours/${g.inviter.uid}`} className="font-semibold hover:underline">
                    {g.inviter.displayName}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">{g.inviter.code}</span>
                  <span className="text-xs text-muted-foreground">{g.reasons.map((r) => INVITE_FLAG_LABELS[r]).join(" · ")}</span>
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {g.invitees.map((i) => (
                    <li key={i.uid}>
                      <Link
                        href={`/admin/neighbours/${i.uid}`}
                        title={i.reasons.map((r) => INVITE_FLAG_LABELS[r]).join(", ")}
                        className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs ring-1 ring-border hover:ring-primary"
                      >
                        {i.displayName} <span className="text-muted-foreground">· {dateLabel(i.joinedAt)}</span>
                        {i.verified && <BadgeCheck className="size-3 text-primary" aria-label="verified" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {board.error && !board.data ? (
        <AdminProblem error={board.error} onRetry={() => void board.refetch()} />
      ) : !board.data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" />
      ) : board.data.people.length === 0 ? (
        <EmptyBody icon={UserPlus} title="No invites yet" description="When neighbours join with someone's code or shared link, they show up here." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Panel title="Top inviters">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Neighbour</th>
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Hood</th>
                    <th className="py-2 pr-3 text-right font-medium">Joined</th>
                    <th className="py-2 pr-3 text-right font-medium">Verified</th>
                    <th className="py-2 text-right font-medium">Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {board.data.people.map((p, i) => (
                    <tr key={p.uid}>
                      <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/neighbours/${p.uid}`} className="font-semibold hover:text-primary hover:underline">
                          {p.displayName}
                        </Link>
                        {p.verified >= BUILDER_INVITES && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            <BadgeCheck className="size-3" aria-hidden /> Builder
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{p.code ?? "—"}</td>
                      <td className="py-2.5 pr-3">{p.hood?.name ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{p.joined}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{p.verified}</td>
                      <td className={p.flagged ? "py-2.5 text-right font-semibold text-amber-700 tabular-nums dark:text-amber-300" : "py-2.5 text-right text-muted-foreground tabular-nums"}>{p.flagged || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Top Hoods">
            <ul className="divide-y divide-border text-sm">
              {board.data.hoods.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/hoods/${h.id}`} className="truncate font-medium hover:text-primary hover:underline">
                    {h.name}
                  </Link>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{h.verified}</span> <span className="text-muted-foreground">/ {h.joined}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Verified / joined, by the inviter&apos;s Hood.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
