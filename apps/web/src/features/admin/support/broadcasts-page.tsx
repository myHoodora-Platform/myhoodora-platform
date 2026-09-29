"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Megaphone, Users } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { MascotMark } from "@myhoodora/ui/logo";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { dateTimeLabel, timeAgo } from "@/components/admin/format";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { listHoods } from "@/lib/api/admin/community";
import { estimateReach, listBroadcasts, sendBroadcast } from "@/lib/api/admin/support";
import type { AdminHood, BroadcastAudience } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

export function BroadcastsPage() {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const history = useAdminQuery(listBroadcasts, "broadcasts");
  const hoods = useAdminQuery((u) => listHoods(u, { pageSize: 200, sort: "name:asc" }), "bc-hoods");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"hood" | "all">("hood");
  const [hoodIds, setHoodIds] = useState<string[]>([]);
  const [reach, setReach] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const audience: BroadcastAudience = mode === "all" ? { type: "all" } : { type: "hood", hoodIds };
  const audienceKey = mode === "all" ? "all" : hoodIds.join(",");

  useEffect(() => {
    if (!user) return;
    if (mode === "hood" && hoodIds.length === 0) {
      setReach(0);
      return;
    }
    let alive = true;
    estimateReach(user, mode === "all" ? { type: "all" } : { type: "hood", hoodIds })
      .then((n) => alive && setReach(n))
      .catch(() => alive && setReach(null));
    return () => {
      alive = false;
    };
    // audienceKey captures hoodIds/mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, audienceKey]);

  if (!can("broadcasts.send")) return <Unauthorized message="Broadcasts are sent by admins." />;

  const valid = title.trim().length >= 3 && body.trim().length >= 10 && (mode === "all" || hoodIds.length > 0);
  const toggleHood = (id: string) => setHoodIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const hoodName = (h: AdminHood) => `${h.name}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Support" }, { label: "Broadcasts" }]}
        title="Broadcasts"
        description="Announcements from myHoodora to neighbours' notifications. Use sparingly. Local news should come from neighbours, not us."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="New broadcast">
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Who should get it?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["hood", "all"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn("flex items-center gap-3 rounded-xl border p-3 text-left text-sm", mode === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}
                  >
                    {m === "hood" ? <Users className="size-4 text-primary" /> : <Megaphone className="size-4 text-primary" />}
                    <span>
                      <span className="block font-semibold">{m === "hood" ? "Selected Hoods" : "Everyone"}</span>
                      <span className="block text-xs text-muted-foreground">{m === "hood" ? "Local notices, launches, outages" : "Platform-wide news only"}</span>
                    </span>
                  </button>
                ))}
              </div>
              {mode === "hood" && (
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border p-3">
                  {(hoods.data?.items ?? []).map((h) => {
                    const on = hoodIds.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleHood(h.id)}
                        className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
                      >
                        {on && <Check className="size-3" aria-hidden />} {hoodName(h)}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
            <Field label="Title" htmlFor="bc-title" hint="Shown in bold on the notification.">
              <input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={fieldInputClass} placeholder="e.g. Scheduled maintenance tonight" />
            </Field>
            <Field label="Message" htmlFor="bc-body" hint={`${body.length}/240`}>
              <textarea id="bc-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={240} rows={3} className={fieldInputClass} />
            </Field>
            <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Will reach about <span className="font-bold">{reach === null ? "…" : reach.toLocaleString()}</span> neighbours
              </p>
              <Button onClick={() => setConfirming(true)} disabled={!valid}>
                Review &amp; send
              </Button>
            </div>
          </div>
        </Panel>

        {/* Phone notification preview */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Preview</p>
          <div className="rounded-[2rem] bg-gradient-to-br from-[#0f5f58] to-[#0b1716] p-4 pt-10 shadow-xl">
            <div className="rounded-2xl bg-white/85 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="flex size-5 items-center justify-center overflow-hidden rounded-md bg-white">
                  <MascotMark size="sm" />
                </span>
                MYHOODORA <span className="ml-auto">now</span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900">{title || "Your title"}</p>
              <p className="text-sm text-slate-700">{body || "Your message appears here, as neighbours will see it on their phone."}</p>
            </div>
          </div>
        </div>
      </div>

      <Panel title="Sent" padded={false}>
        {!history.data ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : history.data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.data.map((b) => (
              <li key={b.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground" title={dateTimeLabel(b.sentAt)}>
                    {timeAgo(b.sentAt)} · {b.sentBy}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{b.body}</p>
                <p className="mt-1 text-xs font-semibold text-primary">
                  {b.audienceLabel} · {b.reach.toLocaleString()} neighbours
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {confirming && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={mode === "all" ? "Send to everyone?" : "Send broadcast?"}
          consequence={`About ${reach?.toLocaleString() ?? "?"} neighbours${mode === "hood" ? ` in ${hoodIds.length} Hood${hoodIds.length > 1 ? "s" : ""}` : " across every Hood"} get a push notification straight away. It can't be unsent.`}
          requireReason={false}
          destructive={mode === "all"}
          confirmLabel="Send now"
          onConfirm={async () => {
            if (!user) return;
            await sendBroadcast(user, { title: title.trim(), body: body.trim(), audience }, role);
            toast.success("Broadcast sent");
            setTitle("");
            setBody("");
            setHoodIds([]);
            void history.refetch();
          }}
        />
      )}
    </div>
  );
}
