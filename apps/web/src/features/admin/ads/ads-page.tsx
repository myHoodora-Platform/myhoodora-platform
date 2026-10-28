"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminAd, AdPlacementSettings, AdStatus } from "@myhoodora/api-contract/ads";
import { BadgeDollarSign, Pause, Play, Plus } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody, Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { dateLabel } from "@/components/admin/format";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getAdSettings, listAds, setAdStatus, updateAdSettings } from "@/lib/api/admin/ads";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

const TABS: { id: AdStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Live" },
  { id: "draft", label: "Drafts" },
  { id: "paused", label: "Paused" },
  { id: "ended", label: "Ended" },
];

const FORMAT_LABEL: Record<AdminAd["format"], string> = { image: "Image", video: "Video", carousel: "Carousel", announcement: "Announcement", business: "Local business" };

/** "Everywhere", "Ikeja, Yaba", "Lagos". */
export function targetingLabel(ad: Pick<AdminAd, "hoodIds" | "cities" | "near">, hoodNames?: Map<string, string>): string {
  if (ad.near) return `Within ${ad.near.radiusKm} km of ${ad.near.label ?? "a place"}`;
  if (!ad.hoodIds.length && !ad.cities.length) return "Everywhere";
  const hoods = ad.hoodIds.map((id) => hoodNames?.get(id) ?? "1 neighbourhood");
  const parts = [...(hoodNames ? hoods : ad.hoodIds.length ? [`${ad.hoodIds.length} neighbourhood${ad.hoodIds.length > 1 ? "s" : ""}`] : []), ...ad.cities];
  return parts.join(", ");
}

export function scheduleLabel(ad: Pick<AdminAd, "startsAt" | "endsAt">): string {
  if (!ad.startsAt && !ad.endsAt) return "No end date";
  if (ad.startsAt && ad.endsAt) return `${dateLabel(ad.startsAt)} – ${dateLabel(ad.endsAt)}`;
  return ad.startsAt ? `From ${dateLabel(ad.startsAt)}` : `Until ${dateLabel(ad.endsAt!)}`;
}

/** `/admin/ads`: every ad with its status, schedule, reach and quick numbers; pause or resume in place. */
export function AdsPage() {
  const { user } = useAuth();
  const { can } = useAdminSession();
  const [tab, setTab] = useState<AdStatus | "all">("all");
  const [q, setQ] = useState("");
  const ads = useAdminQuery((u) => listAds(u, { status: tab, q: q.trim() || undefined }), `ads:${tab}:${q.trim()}`);
  const [busy, setBusy] = useState<string | null>(null);

  if (!can("ads.manage")) return <Unauthorized message="Ads are managed by admins." />;

  const flip = async (ad: AdminAd) => {
    if (!user) return;
    const next = ad.effectiveStatus === "active" ? "paused" : "active";
    setBusy(ad._id);
    try {
      await setAdStatus(user, ad._id, next);
      toast.success(next === "active" ? `${ad.title} is live.` : `${ad.title} is paused.`);
      await ads.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change the ad."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Sponsored" }, { label: "Ads" }]}
        title="Ads"
        description="Sponsored items in neighbourhood feeds. Always labelled “Sponsored”, never two in a row, and capped per neighbour per day."
        actions={
          <Link href="/admin/ads/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden /> New ad
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Ad status" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or advertiser" aria-label="Search ads" className={cn(fieldInputClass, "max-w-xs")} />
      </div>

      <Panel padded={false}>
        {ads.error ? (
          <AdminProblem error={ads.error} onRetry={() => void ads.refetch()} />
        ) : !ads.data ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : ads.data.length === 0 ? (
          <EmptyBody
            icon={BadgeDollarSign}
            title={tab === "all" && !q ? "No ads yet" : "Nothing here"}
            description={tab === "all" && !q ? "Create one: it starts as a draft, and goes live when you say so." : "Try another tab or search."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Ad</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Shown to</th>
                  <th className="px-3 py-3 text-right">Impressions</th>
                  <th className="px-3 py-3 text-right">Clicks</th>
                  <th className="px-3 py-3 text-right">CTR</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ads.data.map((ad) => (
                  <tr key={ad._id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/admin/ads/${ad._id}`} className="font-semibold hover:underline">
                        {ad.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {ad.advertiserName} · {FORMAT_LABEL[ad.format]} · {scheduleLabel(ad)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={ad.effectiveStatus} label={ad.effectiveStatus === "active" ? "Live" : undefined} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{targetingLabel(ad)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{(ad.stats?.impressions ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{(ad.stats?.clicks ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{(ad.stats?.ctr ?? 0).toFixed(2)}%</td>
                    <td className="px-5 py-3 text-right">
                      {(ad.effectiveStatus === "active" || ad.effectiveStatus === "paused") && (
                        <Button size="sm" variant="outline" disabled={busy === ad._id} onClick={() => void flip(ad)} aria-label={ad.effectiveStatus === "active" ? `Pause ${ad.title}` : `Resume ${ad.title}`}>
                          {ad.effectiveStatus === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                          {ad.effectiveStatus === "active" ? "Pause" : "Resume"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <PlacementSettings />
    </div>
  );
}

/** The placement rules (contract §32), with what they mean for a neighbour scrolling. */
function PlacementSettings() {
  const { user } = useAuth();
  const settings = useAdminQuery(getAdSettings, "ad-settings");
  const [draft, setDraft] = useState<AdPlacementSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const current = draft ?? settings.data;
  if (settings.error) return null;
  if (!current) return null;
  const set = (patch: Partial<AdPlacementSettings>) => setDraft({ ...current, ...patch });
  const num = (key: keyof Omit<AdPlacementSettings, "enabled">, label: string, hint: string, min: number, max: number) => (
    <Field label={label} htmlFor={`ads-${key}`} hint={hint}>
      <input id={`ads-${key}`} type="number" min={min} max={max} value={current[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} className={fieldInputClass} />
    </Field>
  );
  const save = async () => {
    if (!user || !draft) return;
    setSaving(true);
    try {
      settings.setData(await updateAdSettings(user, draft));
      setDraft(null);
      toast.success("Placement rules saved. New feed pages use them now.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the rules."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Panel title="Placement rules">
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={current.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          Show ads in feeds
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {num("firstAfter", "Posts before the first ad", "3 means the 4th item at the earliest.", 1, 20)}
          {num("minGap", "Fewest posts between ads", "", 2, 30)}
          {num("maxGap", "Most posts between ads", "Each gap is picked in this range.", 2, 30)}
          {num("minOrganic", "No ads on pages with fewer posts than", "", 1, 20)}
        </div>
        <p className="text-sm text-muted-foreground">
          {current.enabled
            ? `A neighbour scrolling sees the first ad after ${current.firstAfter} posts, then one every ${current.minGap}–${current.maxGap} posts. Never two in a row, never at the very end.`
            : "Ads are off: feeds show posts only."}
        </p>
        <div className="flex justify-end gap-2">
          {draft && (
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={() => void save()} disabled={!draft || saving || current.minGap > current.maxGap}>
            Save rules
          </Button>
        </div>
      </div>
    </Panel>
  );
}
