"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Flag, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { TIER_RING, type EngagementAdmin } from "@myhoodora/api-contract/engagement";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Field, fieldInputClass } from "@/components/shared/field";
import { Switch } from "@/features/settings/ui";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { downloadBuildersCsv, endChallenge, getEngagementAdmin, listBuilders, updateEngagementAdmin } from "@/lib/api/engagement";
import { dateLabel } from "@/components/admin/format";
import { fromLagosInput, toLagosInput } from "../seasons/lagos-time";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

/**
 * Admin → Challenge (plan WP-C): the launch challenge's rules and dates, ending it, the switches for
 * streaks and badges, and the Hood Builders (with an export for the offline team).
 */
export function EngagementPage() {
  const { user } = useAuth();
  const { can } = useAdminSession();
  const view = useAdminQuery((u) => getEngagementAdmin(u), "engagement");
  const builders = useAdminQuery((u) => listBuilders(u), "builders");
  const [draft, setDraft] = useState<EngagementAdmin["settings"] | null>(null);
  const [ending, setEnding] = useState(false);
  const [saving, setSaving] = useState(false);
  const manage = can("engagement.manage");
  useEffect(() => {
    if (view.data) setDraft(view.data.settings);
  }, [view.data]);

  const save = async (patch: Partial<EngagementAdmin["settings"]>) => {
    if (!user) return;
    setSaving(true);
    try {
      view.setData(await updateEngagementAdmin(user, patch));
      toast.success("Saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (view.error && !view.data) return <AdminProblem error={view.error} onRetry={() => void view.refetch()} />;
  if (!view.data || !draft) return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" />;
  const s = view.data.settings;
  const c = view.data.counts;
  const ended = Boolean(s.challengeEndsAt && Date.parse(s.challengeEndsAt) <= Date.now());

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Launch challenge"
        description="Hood Builders: neighbours who brought verified neighbours in, or kept showing up. Counted back to the day the challenge began; badges earned stay after it ends."
        actions={
          <Button variant="outline" onClick={() => user && void downloadBuildersCsv(user).catch((e) => toast.error(errorMessage(e)))}>
            <Download className="size-4" aria-hidden /> Builders CSV
          </Button>
        }
      />
      <dl className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Hood Builders", c.builders, "builder"],
            ["Gold streaks (30+ days)", c.streaks.gold, "gold"],
            ["Silver streaks (7+)", c.streaks.silver, "silver"],
            ["Bronze streaks (3+)", c.streaks.bronze, "bronze"],
          ] as const
        ).map(([label, n, ring]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-3 rounded-full" style={{ background: TIER_RING[ring] }} aria-hidden /> {label}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{n.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      <Panel title="Rules and dates">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" htmlFor="ch-name">
            <input id="ch-name" disabled={!manage} value={draft.challengeName} onChange={(e) => setDraft({ ...draft, challengeName: e.target.value })} className={fieldInputClass} />
          </Field>
          <Field label="Began (Lagos time)" htmlFor="ch-start">
            <input id="ch-start" type="datetime-local" disabled={!manage} value={toLagosInput(draft.challengeStartsAt)} onChange={(e) => setDraft({ ...draft, challengeStartsAt: fromLagosInput(e.target.value) ?? draft.challengeStartsAt })} className={fieldInputClass} />
          </Field>
          <Field label="Verified invites to qualify" htmlFor="ch-inv">
            <input id="ch-inv" type="number" min={1} max={50} disabled={!manage} value={draft.minInvites} onChange={(e) => setDraft({ ...draft, minInvites: Number(e.target.value) })} className={fieldInputClass} />
          </Field>
          <Field label="…or active days" htmlFor="ch-days">
            <input id="ch-days" type="number" min={1} max={60} disabled={!manage} value={draft.minActiveDays} onChange={(e) => setDraft({ ...draft, minActiveDays: Number(e.target.value) })} className={fieldInputClass} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          <label className="flex items-center gap-2">
            <Switch label="Streaks" checked={draft.streaksOn} disabled={!manage} onChange={(on) => setDraft({ ...draft, streaksOn: on })} /> Streaks
          </label>
          <label className="flex items-center gap-2">
            <Switch label="Badges on avatars" checked={draft.badgesOn} disabled={!manage} onChange={(on) => setDraft({ ...draft, badgesOn: on })} /> Badges on avatars
          </label>
          <span className="text-muted-foreground">{ended ? `Ended ${dateLabel(s.challengeEndsAt!)}` : "Running: no end date"}</span>
        </div>
        {manage && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {ended ? (
              <Button variant="outline" disabled={saving} onClick={() => void save({ challengeEndsAt: null })}>
                Reopen the challenge
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setEnding(true)}>
                <Flag className="size-4" aria-hidden /> End the challenge
              </Button>
            )}
            <Button
              disabled={saving}
              onClick={() => void save({ challengeName: draft.challengeName, challengeStartsAt: draft.challengeStartsAt, minInvites: draft.minInvites, minActiveDays: draft.minActiveDays, streaksOn: draft.streaksOn, badgesOn: draft.badgesOn })}
            >
              Save
            </Button>
          </div>
        )}
      </Panel>

      <Panel title={`Hood Builders${builders.data ? ` (${builders.data.length})` : ""}`}>
        {!builders.data ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : builders.data.length === 0 ? (
          <EmptyBody icon={Trophy} title="No Hood Builders yet" description="They appear here as they qualify, or when staff give the badge from a neighbour's page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Neighbour</th>
                  <th className="py-2 pr-3 font-medium">Hood</th>
                  <th className="py-2 pr-3 font-medium">Since</th>
                  <th className="py-2 pr-3 font-medium">How</th>
                  <th className="py-2 pr-3 text-right font-medium">Invites</th>
                  <th className="py-2 text-right font-medium">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {builders.data.map((b) => (
                  <tr key={b.uid}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/neighbours/${b.uid}`} className="font-semibold hover:text-primary hover:underline">
                        {b.displayName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{b.hood ?? "—"}</td>
                    <td className="py-2 pr-3">{dateLabel(b.since)}</td>
                    <td className="py-2 pr-3">{b.by === "staff" ? "Given by staff" : "Earned"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{b.invites}</td>
                    <td className="py-2 text-right tabular-nums">{b.activeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {ending && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setEnding(false)}
          title="End the launch challenge"
          consequence="From now on nobody becomes a Hood Builder by themselves. Everyone who already is keeps the badge. You can reopen it."
          reasons={["Growth from the challenge has levelled off", "Most target Hoods are active", "Moving to the next campaign"]}
          destructive
          confirmLabel="End it"
          onConfirm={async () => {
            if (!user) return;
            view.setData(await endChallenge(user));
            toast.success("The challenge has ended.");
          }}
        />
      )}
    </div>
  );
}
