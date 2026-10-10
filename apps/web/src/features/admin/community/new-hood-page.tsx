"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { createHood } from "@/lib/api/admin/community";
import { createProblem, hoodPlacement } from "@/lib/hood-placement";
import { useAdminSession } from "../session";
import { useHoodsAround } from "./use-hoods-around";

const HoodMap = dynamic(() => import("./hood-map").then((m) => m.HoodMap), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-2xl bg-muted" /> });

const CITIES = [
  { city: "Lagos", lat: 6.5244, lng: 3.3792 },
  { city: "Ibadan", lat: 7.3775, lng: 3.947 },
];

export function NewHoodPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const [name, setName] = useState("");
  const [city, setCity] = useState("Lagos");
  const [lat, setLat] = useState("6.5244");
  const [lng, setLng] = useState("3.3792");
  const [radius, setRadius] = useState(1500);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latN = Number(lat);
  const lngN = Number(lng);
  const validPoint = Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
  const around = useHoodsAround(validPoint ? { lat: latN, lng: lngN } : undefined);

  if (!can("hoods.manage")) return <Unauthorized message="Only admins can create Hoods." />;

  // The API checks again on submit; this is so the admin sees it while placing the circle. Like the
  // API, it ignores archived Hoods: the map still draws them, to keep clear of in case they reopen.
  const placement = validPoint ? hoodPlacement({ name, center: { lat: latN, lng: lngN }, radiusMeters: radius }, around.filter((h) => h.status !== "archived")) : null;
  const problem = placement && createProblem(placement);
  const valid = name.trim().length >= 2 && validPoint && !problem;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const hood = await createHood(user, { name: name.trim(), city, country: "Nigeria", center: { lat: latN, lng: lngN }, radiusMeters: radius, description: description.trim() || undefined }, role);
      toast.success(`${hood.name} is live`);
      router.replace(`/admin/hoods/${hood.id}`);
    } catch (err) {
      setError(errorMessage(err, "Couldn't create the Hood."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Hoods", href: "/admin/hoods" }, { label: "New Hood" }]}
        title="New Hood"
        description="Draw the area a Hood covers. Neighbours whose address falls inside it can verify and join."
      />
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" noValidate>
        <Panel>
          <div className="space-y-4">
            <Field label="Name" htmlFor="h-name" hint="What residents call it, e.g. “Lekki Phase 1” or “Bodija Estate”.">
              <input id="h-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="City" htmlFor="h-city">
              <select
                id="h-city"
                value={city}
                onChange={(e) => {
                  const c = CITIES.find((x) => x.city === e.target.value)!;
                  setCity(c.city);
                  setLat(String(c.lat));
                  setLng(String(c.lng));
                }}
                className={fieldInputClass}
              >
                {CITIES.map((c) => (
                  <option key={c.city}>{c.city}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Centre latitude" htmlFor="h-lat">
                <input id="h-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={fieldInputClass} />
              </Field>
              <Field label="Centre longitude" htmlFor="h-lng">
                <input id="h-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={fieldInputClass} />
              </Field>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Radius: {(radius / 1000).toFixed(1)} km</span>
              <input type="range" min={300} max={6000} step={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </label>
            <Field label="Description" htmlFor="h-desc" optional>
              <textarea id="h-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldInputClass} />
            </Field>
            {(problem || error) && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {problem ?? error}
              </p>
            )}
            {!problem && placement && placement.sharesWith.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                Shares ground with {placement.sharesWith.map((h) => h.name).join(", ")}. Addresses there join the Hood on their side of the dashed line.
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/admin/hoods")}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!valid} loading={busy}>
                Create Hood
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Hoods can overlap, but not over another Hood&apos;s centre.</p>
          </div>
        </Panel>
        <div className="overflow-hidden rounded-2xl border border-border">
          {validPoint ? (
            <HoodMap lat={latN} lng={lngN} radiusMeters={radius} others={around} className="h-80 w-full lg:h-[460px]" />
          ) : (
            <div className="flex h-80 items-center justify-center bg-muted text-sm text-muted-foreground">Enter a valid centre point</div>
          )}
        </div>
      </form>
    </div>
  );
}
