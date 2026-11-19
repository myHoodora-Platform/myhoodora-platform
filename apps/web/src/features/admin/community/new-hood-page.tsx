"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Info, MapPin } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { createHood, listHoods } from "@/lib/api/admin/community";
import type { AdminHood } from "@/lib/api/admin/types";
import {
  cityNameProblem,
  cityOptions,
  DEFAULT_CITIES,
  matchingCity,
  tidyCityName,
} from "@/lib/cities";
import { createProblem, hoodPlacement } from "@/lib/hood-placement";
import { useAdminSession } from "../session";
import { CentreFields, parseCentre } from "./centre-fields";
import { useHoodsAround } from "./use-hoods-around";
import { useAdminQuery } from "../use-admin-query";

const HoodMap = dynamic(() => import("./hood-map").then((m) => m.HoodMap), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-muted" />,
});

/** The value of the City list's last option: the admin types the city instead. */
const NEW_CITY = "__new";

/** Every Hood that isn't archived, for the cities they're in. */
async function listCityHoods(
  user: Parameters<typeof listHoods>[0],
): Promise<AdminHood[]> {
  const out: AdminHood[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await listHoods(user, {
      page,
      pageSize: 100,
      sort: "name:asc",
    });
    out.push(...res.items);
    if (out.length >= res.total || res.items.length === 0) break;
  }
  return out;
}

export function NewHoodPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const [name, setName] = useState("");
  const [cityChoice, setCityChoice] = useState("Lagos");
  const [newCity, setNewCity] = useState("");
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState<string | null>(null);
  const [centre, setCentre] = useState({ lat: "6.5244", lng: "3.3792" });
  const [radius, setRadius] = useState(1500);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const point = parseCentre(centre);
  const around = useHoodsAround(point ?? undefined);
  // The cities that already have a Hood, so a new one joins them rather than starting another.
  const existing = useAdminQuery(listCityHoods, "new-hood:cities");
  const cities = useMemo(
    () => (existing.data ? cityOptions(existing.data) : DEFAULT_CITIES),
    [existing.data],
  );
  const adding = cityChoice === NEW_CITY;
  const typed = tidyCityName(newCity);
  const sameAs = adding ? matchingCity(newCity, cities) : null;
  const cityProblem = adding && !sameAs ? cityNameProblem(newCity) : null;
  const city = adding ? (sameAs ?? typed) : cityChoice;

  if (!can("hoods.manage"))
    return <Unauthorized message="Only admins can create Hoods." />;

  // The API checks again on submit; this is so the admin sees it while placing the circle. Like the
  // API, it ignores archived Hoods: the map still draws them, to keep clear of in case they reopen.
  const placement = point
    ? hoodPlacement(
        { name, center: point, radiusMeters: radius },
        around.filter((h) => h.status !== "archived"),
      )
    : null;
  const problem = placement && createProblem(placement);
  const valid =
    name.trim().length >= 2 && point !== null && !problem && !cityProblem;

  /** Moves the map to the new city, which the admin then fine-tunes. */
  const findCity = async () => {
    if (cityProblem || !typed) return;
    setFinding(true);
    setFindNote(null);
    try {
      const res = await fetch(
        `/api/geocode/place?${new URLSearchParams({ q: typed })}`,
      );
      if (res.status === 404) {
        setFindNote(
          `We couldn't find ${typed} on the map. Click the map or paste its centre instead.`,
        );
        return;
      }
      if (!res.ok) throw new Error(`Place lookup failed: ${res.status}`);
      const found = (await res.json()) as { lat: number; lng: number };
      setCentre({ lat: String(found.lat), lng: String(found.lng) });
      setFindNote(
        `Moved the map to ${typed}. Now place the Hood's centre on its area.`,
      );
    } catch (err) {
      console.error("Place lookup failed", err);
      setFindNote(
        "We couldn't look that up just now. Click the map or paste the centre instead.",
      );
    } finally {
      setFinding(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !valid || !point) return;
    setBusy(true);
    setError(null);
    try {
      const hood = await createHood(
        user,
        {
          name: name.trim(),
          city,
          country: "Nigeria",
          center: point,
          radiusMeters: radius,
          description: description.trim() || undefined,
        },
        role,
      );
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
        crumbs={[
          { label: "Community" },
          { label: "Hoods", href: "/admin/hoods" },
          { label: "New Hood" },
        ]}
        title="New Hood"
        description="Draw the area a Hood covers. Neighbours whose address falls inside it can verify and join."
      />
      <form
        onSubmit={submit}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
        noValidate
      >
        <Panel>
          <div className="space-y-4">
            <Field
              label="Name"
              htmlFor="h-name"
              hint="What residents call it, e.g. “Lekki Phase 1” or “Bodija Estate”."
            >
              <input
                id="h-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldInputClass}
              />
            </Field>
            <Field
              label="City"
              htmlFor="h-city"
              hint={
                adding ? undefined : "A new city starts with its first Hood."
              }
            >
              <select
                id="h-city"
                value={cityChoice}
                onChange={(e) => {
                  setCityChoice(e.target.value);
                  setFindNote(null);
                  const c = cities.find((x) => x.city === e.target.value);
                  if (c) setCentre({ lat: String(c.lat), lng: String(c.lng) });
                }}
                className={fieldInputClass}
              >
                {cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
                <option value={NEW_CITY}>Add a new city…</option>
              </select>
            </Field>
            {adding && (
              <Field
                label="New city"
                htmlFor="h-new-city"
                hint={
                  sameAs
                    ? `Already a city on myHoodora: this Hood joins ${sameAs}.`
                    : ((cityProblem && newCity.trim() ? cityProblem : null) ??
                      (typed && typed !== newCity.trim()
                        ? `Saved as “${typed}”.`
                        : "As residents write it, e.g. “Abuja” or “Port Harcourt”."))
                }
              >
                <div className="flex gap-2">
                  <input
                    id="h-new-city"
                    value={newCity}
                    onChange={(e) => {
                      setNewCity(e.target.value);
                      setFindNote(null);
                    }}
                    maxLength={80}
                    autoComplete="off"
                    className={fieldInputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 whitespace-nowrap"
                    onClick={findCity}
                    disabled={!typed || Boolean(cityProblem)}
                    loading={finding}
                  >
                    <MapPin className="size-4" aria-hidden /> Find on map
                  </Button>
                </div>
              </Field>
            )}
            {adding && findNote && (
              <p role="status" className="text-sm text-muted-foreground">
                {findNote}
              </p>
            )}
            <CentreFields value={centre} onChange={setCentre} />
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Radius: {(radius / 1000).toFixed(1)} km
              </span>
              <input
                type="range"
                min={300}
                max={6000}
                step={100}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </label>
            <Field label="Description" htmlFor="h-desc" optional>
              <textarea
                id="h-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={fieldInputClass}
              />
            </Field>
            {(problem || error) && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden
                />{" "}
                {problem ?? error}
              </p>
            )}
            {!problem && placement && placement.sharesWith.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
                <Info
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                Shares ground with{" "}
                {placement.sharesWith.map((h) => h.name).join(", ")}. Addresses
                there join the Hood on their side of the dashed line.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/hoods")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!valid}
                loading={busy}
              >
                Create Hood
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hoods can overlap, but not over another Hood&apos;s centre.
            </p>
          </div>
        </Panel>
        <div className="overflow-hidden rounded-2xl border border-border">
          {point ? (
            <HoodMap
              lat={point.lat}
              lng={point.lng}
              radiusMeters={radius}
              others={around}
              onPick={(p) =>
                setCentre({ lat: String(p.lat), lng: String(p.lng) })
              }
              className="h-80 w-full lg:h-[460px]"
            />
          ) : (
            <div className="flex h-80 items-center justify-center bg-muted text-sm text-muted-foreground">
              Enter a valid centre point
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
