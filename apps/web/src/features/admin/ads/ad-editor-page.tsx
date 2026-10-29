"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AD_BACKGROUNDS, AD_CTA_LABELS, AD_CTAS, type AdBackground, type AdCta, type AdFormat, type AdminAd, type AdminAdInput, type AdStatsRange } from "@myhoodora/api-contract/ads";
import { Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { ActionDialog } from "@/components/admin/action-dialog";
import { AdminProblem, DetailSkeleton, NotFound, Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { ApiError, errorMessage } from "@/lib/api/client";
import { createAd, deleteAd, getAd, getAdStats, setAdStatus, updateAd } from "@/lib/api/admin/ads";
import { listHoods } from "@/lib/api/admin/community";
import type { AdminHood } from "@/lib/api/admin/types";
import { PHOTO_ACCEPT, uploadMedia } from "@/lib/api/media";
import { PeoplePicker, type Person } from "../people-picker";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { AdPreview } from "./ad-preview";

const FORMATS: { id: AdFormat; label: string; hint: string }[] = [
  { id: "image", label: "Image", hint: "One photo, text and a button" },
  { id: "video", label: "Video", hint: "Plays muted in the feed" },
  { id: "carousel", label: "Carousel", hint: "2–10 cards to swipe" },
  { id: "announcement", label: "Announcement", hint: "Text on a colour" },
  { id: "business", label: "Local business", hint: "Logo, photo and Call / Visit" },
  { id: "listings", label: "Seller's listings", hint: "A neighbour's For Sale items" },
];
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
const EMPTY: AdminAdInput = { title: "", advertiserName: "", format: "image", primaryText: "", headline: "", media: [], cards: [], priority: 5, dailyCapPerUser: 3, hoodIds: [], cities: [], near: null, startsAt: null, endsAt: null };
const RADII = [1, 2, 3, 5, 8, 10, 15, 20] as const;

/** Great-circle km between two points: the same measure the API uses to match neighbourhoods. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** ISO ↔ the browser's local date-time input. */
const toLocalInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** What the API takes from a loaded ad (it refuses fields it doesn't know). */
function inputOf(ad: AdminAd): AdminAdInput {
  const { title, advertiserName, advertiserLogoUrl, format, primaryText, headline, ctaType, ctaUrl, ctaPhone, media, cards, background, sellerUid, startsAt, endsAt, priority, dailyCapPerUser, hoodIds, cities, near } = ad;
  return { title, advertiserName, advertiserLogoUrl, format, primaryText, headline, ctaType, ctaUrl, ctaPhone, media, cards, background, sellerUid, startsAt, endsAt, priority, dailyCapPerUser, hoodIds, cities, near };
}

/** Only what the chosen format uses, so switching formats doesn't send leftovers. */
function forFormat(a: AdminAdInput): AdminAdInput {
  const f = a.format;
  // A seller's listings: their own photos, and the button is always "See all from …".
  if (f === "listings") return { ...a, media: [], cards: [], background: undefined, ctaType: undefined, ctaUrl: undefined, ctaPhone: undefined, headline: undefined, advertiserLogoUrl: undefined };
  return {
    ...a,
    media: f === "announcement" || f === "carousel" ? [] : (a.media ?? []).slice(0, 1).map((m) => (f === "video" ? m : { url: m.url, kind: m.kind })),
    cards: f === "carousel" ? a.cards : [],
    background: f === "announcement" ? (a.background ?? "green") : undefined,
    sellerUid: undefined,
    ctaUrl: a.ctaType && a.ctaType !== "call" ? a.ctaUrl || undefined : undefined,
    ctaPhone: a.ctaType === "call" ? a.ctaPhone || undefined : undefined,
    headline: a.headline || undefined,
    advertiserLogoUrl: a.advertiserLogoUrl || undefined,
  };
}

/** `/admin/ads/new` and `/admin/ads/<id>`: the form, a live preview of the feed card, and (once saved) its numbers. */
export function AdEditorPage({ id }: { id?: string }) {
  const { can } = useAdminSession();
  const loaded = useAdminQuery((u) => (id ? getAd(u, id) : Promise.resolve(null)), `ad:${id ?? "new"}`);
  if (!can("ads.manage")) return <Unauthorized message="Ads are managed by admins." />;
  if (id && loaded.error) {
    return loaded.error instanceof ApiError && loaded.error.status === 404 ? <NotFound backHref="/admin/ads" message="That ad doesn't exist or was deleted." /> : <AdminProblem error={loaded.error} onRetry={() => void loaded.refetch()} backHref="/admin/ads" />;
  }
  if (id && !loaded.data) return <DetailSkeleton />;
  return <Editor key={id ?? "new"} ad={loaded.data ?? undefined} onSaved={(a) => loaded.setData(a)} />;
}

function Editor({ ad, onSaved }: { ad?: AdminAd; onSaved: (ad: AdminAd) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<AdminAdInput>(() => (ad ? inputOf(ad) : EMPTY));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aim, setAim] = useState<"everywhere" | "near" | "hoods" | "cities">(() => (ad?.near ? "near" : ad?.hoodIds.length ? "hoods" : ad?.cities.length ? "cities" : "everywhere"));
  const hoods = useAdminQuery((u) => listHoods(u, { pageSize: 100, sort: "name:asc" }), "ad-hoods");
  const set = (patch: AdminAdInput) => setForm((f) => ({ ...f, ...patch }));
  const [seller, setSeller] = useState<Person[]>(() => (ad?.seller ? [{ uid: ad.seller.uid, displayName: ad.seller.displayName }] : []));
  const listings = form.format === "listings";
  const status = ad?.effectiveStatus;

  const payload = (): AdminAdInput => {
    const f = forFormat(form);
    return { ...f, hoodIds: aim === "hoods" ? f.hoodIds : [], cities: aim === "cities" ? f.cities : [], near: aim === "near" ? (f.near ?? null) : null };
  };

  const save = async (goLive: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      let saved = ad ? await updateAd(user, ad._id, payload()) : await createAd(user, payload());
      if (goLive && saved.effectiveStatus !== "active") saved = await setAdStatus(user, saved._id, "active");
      toast.success(goLive ? "Saved. The ad is live." : ad ? "Changes saved." : "Draft saved.");
      if (!ad) router.replace(`/admin/ads/${saved._id}`);
      else onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the ad."));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (next: "paused" | "active" | "ended") => {
    if (!user || !ad) return;
    setSaving(true);
    try {
      onSaved(await setAdStatus(user, ad._id, next));
      toast.success(next === "active" ? "The ad is live." : next === "paused" ? "Paused." : "Ended.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change the ad."));
    } finally {
      setSaving(false);
    }
  };

  const textLen = form.primaryText?.length ?? 0;
  const headLen = form.headline?.length ?? 0;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Sponsored" }, { label: "Ads", href: "/admin/ads" }, { label: ad ? ad.title : "New ad" }]}
        title={ad ? ad.title : "New ad"}
        meta={status && <StatusBadge status={status} label={status === "active" ? "Live" : undefined} />}
        description="Neighbours see it marked “Sponsored”. Every change is in the audit log."
        actions={
          ad && (
            <div className="flex flex-wrap gap-2">
              {status === "active" && (
                <Button variant="outline" onClick={() => void changeStatus("paused")} disabled={saving}>
                  Pause
                </Button>
              )}
              {status === "paused" && (
                <Button variant="outline" onClick={() => void changeStatus("active")} disabled={saving}>
                  Resume
                </Button>
              )}
              {(status === "active" || status === "paused") && (
                <Button variant="outline" onClick={() => void changeStatus("ended")} disabled={saving}>
                  End
                </Button>
              )}
              <Button variant="outline" onClick={() => setDeleting(true)} disabled={saving} className="text-destructive">
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Ad">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name (staff only)" htmlFor="ad-title" hint="For this list and the audit log.">
                  <input id="ad-title" value={form.title ?? ""} onChange={(e) => set({ title: e.target.value })} maxLength={80} className={fieldInputClass} placeholder="e.g. Mama Put, December" />
                </Field>
                <Field label="Advertiser" htmlFor="ad-advertiser" hint="Shown above “Sponsored”.">
                  <input id="ad-advertiser" value={form.advertiserName ?? ""} onChange={(e) => set({ advertiserName: e.target.value })} maxLength={60} className={fieldInputClass} />
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Format</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={form.format === f.id}
                      onClick={() => set({ format: f.id })}
                      className={cn("rounded-xl border p-3 text-left text-sm", form.format === f.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}
                    >
                      <span className="block font-semibold">{f.label}</span>
                      <span className="block text-xs text-muted-foreground">{f.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {listings && (
                <Field label="Seller" htmlFor="ad-seller" hint="Their items for sale (available ones, newest first) fill the card. While it's live, neighbours it reaches can open them and message the seller.">
                  <PeoplePicker
                    people={seller}
                    onChange={(p) => {
                      setSeller(p);
                      set({ sellerUid: p[0]?.uid, ...(p[0] && !form.advertiserName && { advertiserName: p[0].displayName.slice(0, 60) }) });
                    }}
                  />
                </Field>
              )}

              <Field label={form.format === "announcement" ? "Announcement" : "Text"} htmlFor="ad-text" optional={listings} hint={`${textLen}/500 · about 125 characters show before “See more”`}>
                <textarea id="ad-text" value={form.primaryText ?? ""} onChange={(e) => set({ primaryText: e.target.value })} maxLength={500} rows={3} className={fieldInputClass} />
              </Field>

              {!listings && <MediaFields form={form} set={set} />}

              {form.format === "announcement" && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Colour</legend>
                  <div className="flex gap-2">
                    {AD_BACKGROUNDS.map((b) => (
                      <button key={b} type="button" aria-pressed={(form.background ?? "green") === b} aria-label={b} onClick={() => set({ background: b as AdBackground })} className={cn("size-9 rounded-full ring-offset-2", SWATCH[b], (form.background ?? "green") === b && "ring-2 ring-primary")} />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </Panel>

          {!listings && (
          <Panel title="Button">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What it does" htmlFor="ad-cta" optional={form.format === "announcement" || form.format === "carousel"}>
                <select id="ad-cta" value={form.ctaType ?? ""} onChange={(e) => set({ ctaType: (e.target.value || undefined) as AdCta | undefined })} className={fieldInputClass}>
                  <option value="">No button</option>
                  {AD_CTAS.map((c) => (
                    <option key={c} value={c}>
                      {AD_CTA_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
              {form.ctaType === "call" ? (
                <Field label="Phone number" htmlFor="ad-phone" hint="Digits, with + for international.">
                  <input id="ad-phone" value={form.ctaPhone ?? ""} onChange={(e) => set({ ctaPhone: e.target.value.replace(/[^\d+]/g, "") })} className={fieldInputClass} inputMode="tel" placeholder="+2348012345678" />
                </Field>
              ) : form.ctaType ? (
                <Field label="Link" htmlFor="ad-url" hint="Must start with https://">
                  <input id="ad-url" value={form.ctaUrl ?? ""} onChange={(e) => set({ ctaUrl: e.target.value.trim() })} className={fieldInputClass} inputMode="url" placeholder="https://" />
                </Field>
              ) : null}
              {form.format !== "carousel" && (
                <Field label="Headline" htmlFor="ad-headline" optional hint={`${headLen}/60 · 27–40 characters read best`}>
                  <input id="ad-headline" value={form.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} maxLength={60} className={fieldInputClass} />
                </Field>
              )}
            </div>
          </Panel>
          )}

          <Panel title="Who sees it, and when">
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Who sees it" className="flex flex-wrap gap-2">
                {(
                  [
                    ["everywhere", "Every neighbourhood"],
                    ["near", "Near a neighbourhood"],
                    ["hoods", "Chosen neighbourhoods"],
                    ["cities", "Cities"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={aim === id} onClick={() => setAim(id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", aim === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                    {label}
                  </button>
                ))}
              </div>
              {aim === "near" && <NearPicker hoods={hoods.data?.items} near={form.near ?? null} onChange={(near) => set({ near })} />}
              {aim === "hoods" &&
                (!hoods.data ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading neighbourhoods…
                  </p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border p-3">
                    {hoods.data.items.map((h) => {
                      const on = form.hoodIds?.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set({ hoodIds: on ? form.hoodIds!.filter((x) => x !== h.id) : [...(form.hoodIds ?? []), h.id] })}
                          className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
                        >
                          {on && <Check className="size-3" aria-hidden />} {h.name}
                          <span className="font-normal text-muted-foreground">· {h.city}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              {aim === "cities" && (
                <Field label="Cities" htmlFor="ad-cities" hint="Separate with commas, as neighbourhoods name them (e.g. Lagos, Abuja).">
                  <input
                    id="ad-cities"
                    defaultValue={form.cities?.join(", ")}
                    onChange={(e) => set({ cities: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
                    className={fieldInputClass}
                  />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Starts" htmlFor="ad-start" optional>
                  <input id="ad-start" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Ends" htmlFor="ad-end" optional>
                  <input id="ad-end" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Priority" htmlFor="ad-priority" hint="1–10: higher wins slots more often.">
                  <input id="ad-priority" type="number" min={1} max={10} value={form.priority ?? 5} onChange={(e) => set({ priority: Number(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Times a day per neighbour" htmlFor="ad-cap">
                  <input id="ad-cap" type="number" min={1} max={20} value={form.dailyCapPerUser ?? 3} onChange={(e) => set({ dailyCapPerUser: Number(e.target.value) })} className={fieldInputClass} />
                </Field>
              </div>
            </div>
          </Panel>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => void save(false)} disabled={saving || !form.title?.trim() || !form.advertiserName?.trim()}>
              {ad ? "Save changes" : "Save draft"}
            </Button>
            {status !== "active" && (
              <Button onClick={() => void save(true)} disabled={saving || !form.title?.trim() || !form.advertiserName?.trim()}>
                Save and go live
              </Button>
            )}
          </div>

          {ad && <StatsPanel id={ad._id} />}
        </div>

        <div className="space-y-2 lg:sticky lg:top-6">
          <p className="text-sm font-semibold text-muted-foreground">How it looks in the feed</p>
          <AdPreview ad={forFormat(form)} sellerName={seller[0]?.displayName} />
        </div>
      </div>

      {deleting && ad && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDeleting(false)}
          title={`Delete “${ad.title}”?`}
          consequence="It leaves every feed at once. Its numbers are kept, but the ad can't be brought back."
          requireReason={false}
          destructive
          confirmLabel="Delete ad"
          onConfirm={async () => {
            if (!user) return;
            await deleteAd(user, ad._id);
            toast.success("Ad deleted.");
            router.replace("/admin/ads");
          }}
        />
      )}
    </div>
  );
}

/**
 * Pick the centre from the neighbourhoods we have, then how far around it: every neighbourhood whose
 * centre is within that distance sees the ad (listed below, as the API will match them).
 */
function NearPicker({ hoods, near, onChange }: { hoods?: AdminHood[]; near: AdminAdInput["near"]; onChange: (near: AdminAdInput["near"]) => void }) {
  if (!hoods) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading neighbourhoods…
      </p>
    );
  }
  const centre = near ? hoods.find((h) => h.center.lat === near.lat && h.center.lng === near.lng) : undefined;
  const radius = near?.radiusKm ?? 3;
  const reached = near ? hoods.filter((h) => distanceKm(near, h.center) <= near.radiusKm).sort((a, b) => distanceKm(near, a.center) - distanceKm(near, b.center)) : [];
  const pick = (id: string, km = radius) => {
    const h = hoods.find((x) => x.id === id);
    onChange(h ? { lat: h.center.lat, lng: h.center.lng, radiusKm: km, label: h.name } : null);
  };
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Centred on" htmlFor="ad-near-hood">
          <select id="ad-near-hood" value={centre?.id ?? ""} onChange={(e) => pick(e.target.value)} className={fieldInputClass}>
            <option value="">Choose a neighbourhood</option>
            {hoods.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.city}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Within" htmlFor="ad-near-radius">
          <select id="ad-near-radius" value={radius} disabled={!near} onChange={(e) => near && onChange({ ...near, radiusKm: Number(e.target.value) })} className={fieldInputClass}>
            {RADII.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </Field>
      </div>
      {near && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">
            Reaches {reached.length} neighbourhood{reached.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reached.map((h) => (
              <span key={h.id} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {h.name} <span className="font-normal text-muted-foreground">· {distanceKm(near, h.center).toFixed(1)} km</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Measured from each neighbourhood&apos;s centre. Neighbours&apos; own locations are never used for ads.</p>
        </div>
      )}
    </div>
  );
}

const SWATCH: Record<AdBackground, string> = { green: "bg-[#E7F4EE]", blue: "bg-[#E8F0FE]", amber: "bg-[#FEF3C7]", rose: "bg-[#FFE4E6]", slate: "bg-[#F1F5F9]" };

/** Uploads through the usual pipeline (type, size and length checked by the API), stored for ads only. */
function Upload({ label, accept, onDone, current, onClear }: { label: string; accept: string; onDone: (url: string) => void; current?: string; onClear?: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted", busy && "pointer-events-none opacity-60")}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {busy ? `Uploading ${Math.round(progress * 100)}%` : current ? label.replace(/^Upload/, "Replace") : label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !user) return;
            setBusy(true);
            setProgress(0);
            try {
              onDone((await uploadMedia(user, file, "ad", setProgress)).url);
            } catch (err) {
              toast.error(errorMessage(err, "Couldn't upload that file."));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {current && onClear && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <X className="size-3.5" aria-hidden /> Remove
        </button>
      )}
    </div>
  );
}

function MediaFields({ form, set }: { form: AdminAdInput; set: (p: AdminAdInput) => void }) {
  const f = form.format;
  const media = form.media?.[0];
  const cards = form.cards ?? [];
  return (
    <div className="space-y-3">
      {f === "business" || form.advertiserLogoUrl ? (
        <Field label="Logo" htmlFor="ad-logo" optional={f !== "business"} hint="Square, shown round.">
          <Upload label="Upload logo" accept={PHOTO_ACCEPT} current={form.advertiserLogoUrl} onDone={(url) => set({ advertiserLogoUrl: url })} onClear={() => set({ advertiserLogoUrl: undefined })} />
        </Field>
      ) : null}
      {(f === "image" || f === "business") && (
        <Field label="Image" htmlFor="ad-image" hint="Square or 4:5, at least 600 px wide.">
          <Upload label="Upload image" accept={PHOTO_ACCEPT} current={media?.kind === "image" ? media.url : undefined} onDone={(url) => set({ media: [{ url, kind: "image" }] })} onClear={() => set({ media: [] })} />
        </Field>
      )}
      {f === "video" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Video" htmlFor="ad-video" hint="MP4, MOV or WebM, up to 60 seconds. Plays muted; add captions.">
            <Upload label="Upload video" accept={VIDEO_ACCEPT} current={media?.kind === "video" ? media.url : undefined} onDone={(url) => set({ media: [{ url, kind: "video", posterUrl: media?.posterUrl }] })} onClear={() => set({ media: [] })} />
          </Field>
          <Field label="Poster image" htmlFor="ad-poster" hint="Shown before it plays.">
            <Upload label="Upload poster" accept={PHOTO_ACCEPT} current={media?.posterUrl} onDone={(url) => set({ media: [{ url: media?.url ?? "", kind: "video", posterUrl: url }] })} />
          </Field>
        </div>
      )}
      {f === "carousel" && (
        <div className="space-y-3">
          {cards.map((c, i) => (
            <div key={i} className="grid items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[auto_1fr_1fr_auto]">
              <Upload label="Image" accept={PHOTO_ACCEPT} current={c.imageUrl || undefined} onDone={(url) => set({ cards: cards.map((x, j) => (j === i ? { ...x, imageUrl: url } : x)) })} />
              <Field label={`Card ${i + 1} headline`} htmlFor={`card-h-${i}`}>
                <input id={`card-h-${i}`} value={c.headline} maxLength={40} onChange={(e) => set({ cards: cards.map((x, j) => (j === i ? { ...x, headline: e.target.value } : x)) })} className={fieldInputClass} />
              </Field>
              <Field label="Link" htmlFor={`card-u-${i}`}>
                <input id={`card-u-${i}`} value={c.url} onChange={(e) => set({ cards: cards.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)) })} className={fieldInputClass} placeholder="https://" />
              </Field>
              <Button variant="outline" size="sm" onClick={() => set({ cards: cards.filter((_, j) => j !== i) })} aria-label={`Remove card ${i + 1}`}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {cards.length < 10 && (
            <Button variant="outline" size="sm" onClick={() => set({ cards: [...cards, { imageUrl: "", headline: "", url: "" }] })}>
              Add a card
            </Button>
          )}
          <p className="text-xs text-muted-foreground">2 to 10 square cards, each with its own link. Images at least 600 px wide.</p>
        </div>
      )}
      {f !== "business" && !form.advertiserLogoUrl && (
        <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => set({ advertiserLogoUrl: "" })}>
          Add the advertiser&apos;s logo
        </button>
      )}
    </div>
  );
}

const RANGES = [7, 30, 90] as const;

/** Impressions, reach, clicks, CTR, hides and reports for a period, with a bar per day. */
function StatsPanel({ id }: { id: string }) {
  const { user } = useAuth();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<AdStatsRange | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getAdStats(user, id, { from: new Date(Date.now() - days * 86_400_000).toISOString() })
      .then((s) => alive && (setStats(s), setError(null)))
      .catch((e: unknown) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [user, id, days]);
  const peak = Math.max(1, ...(stats?.daily.map((d) => d.impressions) ?? [0]));
  return (
    <Panel
      title="Results"
      action={
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", days === d ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {d} days
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <AdminProblem error={error} onRetry={() => setDays((d) => d)} />
      ) : !stats ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Impressions", stats.impressions.toLocaleString()],
                ["Reach", stats.reach.toLocaleString()],
                ["Clicks", stats.clicks.toLocaleString()],
                ["CTR", `${stats.ctr.toFixed(2)}%`],
                ["Hidden", stats.hides.toLocaleString()],
                ["Reports", stats.reports.toLocaleString()],
                ["Video plays", stats.videoPlays.toLocaleString()],
                ["Sound turned on", stats.unmutes.toLocaleString()],
                ["Carousel swipes", stats.swipes.toLocaleString()],
                ["“Why this ad?” opened", stats.whyOpens.toLocaleString()],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {stats.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">No impressions in this period yet.</p>
          ) : (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Impressions per day (clicks in the label)</p>
              <ol className="flex h-32 items-end gap-1" aria-label="Impressions per day">
                {stats.daily.map((d) => (
                  <li key={d.day} className="flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.impressions} impressions, ${d.clicks} clicks`}>
                    <span className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (d.impressions / peak) * 100)}%` }} />
                    <span className="sr-only">
                      {d.day}: {d.impressions} impressions, {d.clicks} clicks
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{stats.daily[0]!.day}</span>
                <span>{stats.daily.at(-1)!.day}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
