"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/client";
import { Check, Loader2, Megaphone, RefreshCw, User as UserIcon, Users } from "lucide-react";
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
import { getNeighbour, listHoods } from "@/lib/api/admin/community";
import { estimateReach, listBroadcasts, retryBroadcast, sendBroadcast } from "@/lib/api/admin/support";
import type { AdminHood, BroadcastAudience } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { PeoplePicker, type Person } from "../people-picker";
import { useAdminQuery } from "../use-admin-query";

type Mode = "hood" | "people" | "all";

// The API accepts at most 100 per page (PageQuery) and Hoods number in the tens.
const HOODS_PAGE = 100;
// Same cap as the API's AudienceDto.uids.
const MAX_PEOPLE = 500;

const MODES: { id: Mode; label: string; hint: string; icon: typeof Users }[] = [
  {
    id: "hood",
    label: "Selected Hoods",
    hint: "Local notices, launches, outages",
    icon: Users,
  },
  {
    id: "people",
    label: "Specific people",
    hint: "A notice to one or a few neighbours",
    icon: UserIcon,
  },
  {
    id: "all",
    label: "Everyone",
    hint: "Platform-wide news only",
    icon: Megaphone,
  },
];

export function BroadcastsPage() {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const history = useAdminQuery(listBroadcasts, "broadcasts");
  // Delivery happens after the request: keep the progress line moving until it's done.
  const sending = history.data?.some((b) => b.status === "sending") ?? false;
  const refetchHistory = history.refetch;
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => void refetchHistory(), 3000);
    return () => clearInterval(timer);
  }, [sending, refetchHistory]);
  const hoods = useAdminQuery((u) => listHoods(u, { pageSize: HOODS_PAGE, sort: "name:asc" }), "bc-hoods");
  // /admin/broadcasts?to=<uid> (e.g. "Send a notice" on a neighbour's page) starts with that person.
  const preselectUid = useSearchParams().get("to");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Mode>(preselectUid ? "people" : "hood");
  const [hoodIds, setHoodIds] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [reach, setReach] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!user || !preselectUid) return;
    let alive = true;
    getNeighbour(user, preselectUid)
      .then((n) => alive && setPeople((p) => (p.some((x) => x.uid === n.uid) ? p : [{ uid: n.uid, displayName: n.displayName, hood: n.hood }, ...p])))
      .catch(() => alive && toast.error("Couldn't load that neighbour. Search for them below."));
    return () => {
      alive = false;
    };
  }, [user, preselectUid]);

  const uids = people.map((p) => p.uid);
  const audience: BroadcastAudience = mode === "all" ? { type: "all" } : mode === "people" ? { type: "user", uids } : { type: "hood", hoodIds };
  const audienceKey = mode === "all" ? "all" : mode === "people" ? `u:${uids.join(",")}` : `h:${hoodIds.join(",")}`;
  const nothingChosen = (mode === "hood" && hoodIds.length === 0) || (mode === "people" && uids.length === 0);

  useEffect(() => {
    if (!user) return;
    if (nothingChosen) {
      setReach(0);
      return;
    }
    let alive = true;
    estimateReach(user, audience)
      .then((n) => alive && setReach(n))
      .catch(() => alive && setReach(null));
    return () => {
      alive = false;
    };
    // audienceKey captures mode, hoodIds and people changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, audienceKey]);

  if (!can("broadcasts.send")) return <Unauthorized message="Broadcasts are sent by admins." />;

  const valid = title.trim().length >= 3 && body.trim().length >= 10 && !nothingChosen;
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
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.filter((m) => m.id !== "all" || role !== "moderator").map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left text-sm",
                      mode === m.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <m.icon className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              {mode === "hood" &&
                (hoods.error ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                    <span className="text-muted-foreground">Couldn&apos;t load Hoods.</span>
                    <Button size="sm" variant="outline" onClick={() => void hoods.refetch()}>
                      <RefreshCw className="size-3.5" /> Try again
                    </Button>
                  </div>
                ) : !hoods.data ? (
                  <p className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading Hoods…
                  </p>
                ) : hoods.data.items.length === 0 ? (
                  <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">No Hoods yet. Create one under Community → Hoods.</p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border p-3">
                    {hoods.data.items.map((h) => {
                      const on = hoodIds.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleHood(h.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
                            on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                          )}
                        >
                          {on && <Check className="size-3" aria-hidden />} {hoodName(h)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              {mode === "people" && <PeoplePicker people={people} onChange={setPeople} max={MAX_PEOPLE} />}
            </fieldset>
            <Field label="Title" htmlFor="bc-title" hint="Shown in bold on the notification.">
              <input
                id="bc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                className={fieldInputClass}
                placeholder="e.g. Scheduled maintenance tonight"
              />
            </Field>
            <Field label="Message" htmlFor="bc-body" hint={`${body.length}/240`}>
              <textarea id="bc-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={240} rows={3} className={fieldInputClass} />
            </Field>
            <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Will reach {mode === "people" ? "" : "about "}
                <span className="font-bold">{reach === null ? "…" : reach.toLocaleString()}</span> {reach === 1 ? "neighbour" : "neighbours"}
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
                  {b.audienceLabel} · {b.reach.toLocaleString()} {b.reach === 1 ? "neighbour" : "neighbours"}
                </p>
                {b.status === "sending" && (
                  <p className="mt-1 text-xs text-muted-foreground" role="status">
                    Sending… {(b.delivered ?? 0).toLocaleString()} of {b.reach.toLocaleString()} delivered
                  </p>
                )}
                {b.status === "failed" && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-destructive" role="status">
                    Stopped after {(b.delivered ?? 0).toLocaleString()} of {b.reach.toLocaleString()}.
                    <button
                      type="button"
                      className="font-semibold underline underline-offset-2"
                      onClick={async () => {
                        if (!user) return;
                        try {
                          await retryBroadcast(user, b.id);
                          toast.success("Sending the rest. Nobody gets it twice.");
                        } catch (err) {
                          toast.error(errorMessage(err, "Couldn't retry this broadcast."));
                        }
                        void history.refetch();
                      }}
                    >
                      Send to the rest
                    </button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {confirming && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={
            mode === "all"
              ? "Send to everyone?"
              : mode === "people"
                ? `Send to ${people.length === 1 ? people[0]!.displayName : `${people.length} people`}?`
                : "Send broadcast?"
          }
          consequence={
            mode === "people"
              ? `${people.length === 1 ? people[0]!.displayName : `${people.length} neighbours`} get${people.length === 1 ? "s" : ""} a notification straight away. It can't be unsent.`
              : `About ${reach?.toLocaleString() ?? "?"} neighbours${mode === "hood" ? ` in ${hoodIds.length} Hood${hoodIds.length > 1 ? "s" : ""}` : " across every Hood"} get a push notification straight away. It can't be unsent.`
          }
          requireReason={false}
          destructive={mode === "all"}
          confirmLabel="Send now"
          onConfirm={async () => {
            if (!user) return;
            await sendBroadcast(user, { title: title.trim(), body: body.trim(), audience }, role);
            toast.success("Broadcast on its way");
            setTitle("");
            setBody("");
            setHoodIds([]);
            setPeople([]);
            void history.refetch();
          }}
        />
      )}
    </div>
  );
}
