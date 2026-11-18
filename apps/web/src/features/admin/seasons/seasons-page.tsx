"use client";

import { useState } from "react";
import { CalendarClock, ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import {
  SEASON_ACCENTS,
  SEASON_EFFECT_LABELS,
  SEASON_EFFECTS,
  SEASON_INTENSITIES,
  SEASON_MASCOT_LABELS,
  SEASON_MASCOTS,
  SEASON_PALETTES,
  type AdminSeason,
  type AdminSeasonInput,
} from "@myhoodora/api-contract/seasons";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { PHOTO_ACCEPT, uploadMedia } from "@/lib/api/media";
import { createSeason, deleteSeason, listSeasons, updateSeason } from "@/lib/api/admin/seasons";
import { FestiveMascot } from "@/features/season/festive-mascot";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { fromLagosInput, lagosLabel, toLagosInput } from "./lagos-time";

const BLANK: AdminSeasonInput = { key: "", label: "", enabled: true, effect: "sparkle", intensity: "normal", mascot: "none", accent: "red", greetingTitle: "", greetingBody: "", countdownTo: null };

/**
 * Admin → Settings → Seasons (plan WP-D): when Christmas and New Year (or any celebration) show in the apps,
 * and how they look. Times are Lagos time. The apps switch on and off by themselves at the minute.
 */
export function SeasonsPage() {
  const { can } = useAdminSession();
  const seasons = useAdminQuery((u) => listSeasons(u), "seasons");
  const [editing, setEditing] = useState<AdminSeason | "new" | null>(null);
  const editable = can("settings.manage");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seasons"
        description="Festive looks in the web and phone apps: lights, sparkles or fireworks, a greeting card and the mascot in a hat. Times are Lagos time; everyone can turn the effects off in their settings."
        actions={
          editable && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add a season
            </Button>
          )
        }
      />
      {editing && <SeasonEditor season={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => void seasons.refetch()} />}
      {seasons.error && !seasons.data ? (
        <AdminProblem error={seasons.error} onRetry={() => void seasons.refetch()} />
      ) : !seasons.data ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" aria-label="Loading" />
      ) : seasons.data.length === 0 ? (
        <EmptyBody icon={Sparkles} title="No seasons yet" description="Add one for the next celebration." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {seasons.data.map((s) => (
            <li key={s._id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <FestiveMascot hat={s.mascot} className="mt-2 size-11" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.label}
                    {s.live ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">On now</span>
                    ) : !s.enabled ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Off</span>
                    ) : Date.parse(s.endsAt) < Date.now() ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Over</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">Scheduled</span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden /> {lagosLabel(s.startsAt)} → {lagosLabel(s.endsAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SEASON_EFFECT_LABELS[s.effect]} · {s.intensity} · {SEASON_MASCOT_LABELS[s.mascot]}
                    {s.countdownTo ? ` · countdown to ${lagosLabel(s.countdownTo)}` : ""}
                  </p>
                  {s.greetingTitle && <p className="mt-2 text-sm">{s.greetingTitle}</p>}
                </div>
              </div>
              {editable && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeasonEditor({ season, onClose, onSaved }: { season: AdminSeason | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<AdminSeasonInput>(() => (season ? { ...season } : { ...BLANK }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: AdminSeasonInput) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { key, ...rest } = form;
      const body: AdminSeasonInput = { ...rest, ...(!season && { key }), imageUrl: form.imageUrl || null, imageCredit: form.imageCredit || null };
      if (season) await updateSeason(user, season._id, body);
      else await createSeason(user, body);
      toast.success(season ? "Season saved." : "Season added.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!user || !season || !window.confirm(`Delete ${season.label}? The apps stop showing it straight away.`)) return;
    try {
      await deleteSeason(user, season._id);
      toast.success("Season deleted.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const upload = async (file: File | undefined) => {
    if (!user || !file) return;
    setUploading(true);
    try {
      set({ imageUrl: (await uploadMedia(user, file, "ad")).url });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  const colours = SEASON_PALETTES[form.accent ?? "red"];

  return (
    <Panel title={season ? `Edit ${season.label}` : "Add a season"}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (staff only)" htmlFor="season-label">
              <input id="season-label" value={form.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="Eid al-Fitr 2027" className={fieldInputClass} />
            </Field>
            {!season && (
              <Field label="Key" htmlFor="season-key" hint="Lowercase and dashes, e.g. eid-2027. Can't change later.">
                <input id="season-key" value={form.key ?? ""} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className={fieldInputClass} />
              </Field>
            )}
            <Field label="Starts (Lagos time)" htmlFor="season-start">
              <input id="season-start" type="datetime-local" value={toLagosInput(form.startsAt)} onChange={(e) => set({ startsAt: fromLagosInput(e.target.value) ?? undefined })} className={fieldInputClass} />
            </Field>
            <Field label="Ends (Lagos time)" htmlFor="season-end">
              <input id="season-end" type="datetime-local" value={toLagosInput(form.endsAt)} onChange={(e) => set({ endsAt: fromLagosInput(e.target.value) ?? undefined })} className={fieldInputClass} />
            </Field>
            <Field label="Effect" htmlFor="season-effect">
              <select id="season-effect" value={form.effect} onChange={(e) => set({ effect: e.target.value as AdminSeason["effect"] })} className={fieldInputClass}>
                {SEASON_EFFECTS.map((e) => (
                  <option key={e} value={e}>
                    {SEASON_EFFECT_LABELS[e]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How much" htmlFor="season-intensity" hint="Subtle uses the fewest sparkles: kinder to cheap phones.">
              <select id="season-intensity" value={form.intensity} onChange={(e) => set({ intensity: e.target.value as AdminSeason["intensity"] })} className={fieldInputClass}>
                {SEASON_INTENSITIES.map((i) => (
                  <option key={i} value={i}>
                    {i[0]!.toUpperCase() + i.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mascot" htmlFor="season-mascot">
              <select id="season-mascot" value={form.mascot} onChange={(e) => set({ mascot: e.target.value as AdminSeason["mascot"] })} className={fieldInputClass}>
                {SEASON_MASCOTS.map((m) => (
                  <option key={m} value={m}>
                    {SEASON_MASCOT_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Colours</legend>
              <div className="flex gap-2">
                {SEASON_ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={form.accent === a}
                    aria-label={a}
                    onClick={() => set({ accent: a })}
                    className={cn("flex h-9 items-center gap-0.5 rounded-full border px-2", form.accent === a ? "border-primary ring-2 ring-primary/40" : "border-border")}
                  >
                    {SEASON_PALETTES[a].slice(0, 4).map((c) => (
                      <span key={c} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                    ))}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <Field label="Greeting title" htmlFor="season-title" optional>
            <input id="season-title" maxLength={80} value={form.greetingTitle ?? ""} onChange={(e) => set({ greetingTitle: e.target.value })} className={fieldInputClass} />
          </Field>
          <Field label="Greeting" htmlFor="season-body" optional>
            <textarea id="season-body" rows={3} maxLength={280} value={form.greetingBody ?? ""} onChange={(e) => set({ greetingBody: e.target.value })} className={fieldInputClass} />
          </Field>
          <Field label="Countdown to (Lagos time)" htmlFor="season-countdown" optional hint="New Year: midnight. The card counts down and the fireworks burst then.">
            <input id="season-countdown" type="datetime-local" value={toLagosInput(form.countdownTo)} onChange={(e) => set({ countdownTo: fromLagosInput(e.target.value) })} className={fieldInputClass} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Illustration or GIF <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            {form.imageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file */}
                <img src={form.imageUrl} alt="" className="h-20 rounded-lg object-contain ring-1 ring-border" />
                <Button size="sm" variant="outline" onClick={() => set({ imageUrl: null })}>
                  Remove
                </Button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                <ImagePlus className="size-4" aria-hidden /> {uploading ? "Uploading…" : "Upload an image or GIF"}
                <input type="file" accept={`${PHOTO_ACCEPT},image/gif`} className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />
              </label>
            )}
            <Field label="Credit" htmlFor="season-credit" optional hint="What the image's licence asks for, e.g. “Designed by Freepik”. Shown under it.">
              <input id="season-credit" maxLength={120} value={form.imageCredit ?? ""} onChange={(e) => set({ imageCredit: e.target.value })} className={fieldInputClass} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={form.enabled ?? true} onChange={(e) => set({ enabled: e.target.checked })} /> On (between the dates above)
          </label>
          <div className="flex flex-wrap justify-between gap-2">
            {season ? (
              <Button variant="outline" onClick={() => void remove()}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving || !form.label || !form.startsAt || !form.endsAt || (!season && !form.key)}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>

        <aside aria-label="Preview" className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            {form.effect !== "none" && (
              <div className="flex justify-around bg-muted/40 py-1.5" aria-hidden>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="h-3 w-2 rounded-full" style={{ background: colours[i % colours.length] }} />
                ))}
              </div>
            )}
            <div className="m-3 rounded-2xl border p-3" style={{ borderColor: colours[0] }}>
              <div className="flex gap-3">
                <FestiveMascot hat={form.mascot ?? "none"} className="mt-2 size-11" />
                <div className="min-w-0">
                  <p className="font-bold">{form.greetingTitle || "Your greeting title"}</p>
                  <p className="text-xs text-muted-foreground">{form.greetingBody || "The greeting shows at the top of everyone's feed until they close it."}</p>
                </div>
              </div>
              {form.imageUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file */}
                  <img src={form.imageUrl} alt="" className="mt-2 max-h-32 w-full rounded-lg object-contain" />
                  {form.imageCredit && <p className="mt-1 text-right text-[10px] text-muted-foreground">{form.imageCredit}</p>}
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {SEASON_EFFECT_LABELS[form.effect ?? "none"]} play for a few seconds when the app opens, then stay still. People who turned effects off, or ask their phone to reduce motion, see the card only.
          </p>
        </aside>
      </div>
    </Panel>
  );
}
