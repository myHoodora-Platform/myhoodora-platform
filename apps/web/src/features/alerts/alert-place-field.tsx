"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ALERT_PLACE_LABEL_MAX, alertPlaceInReach, cleanPlaceLabel } from "@myhoodora/api-contract/geo";
import type { AlertPlace } from "@myhoodora/api-contract/types";
import { fieldInputClass } from "@/components/shared/field";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";

// The onboarding map (MapLibre), loaded only when someone adds a place.
const LocationMap = dynamic(() => import("@/features/onboarding/location-map").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/** The street (or the area) of a looked-up point, for the place's name. */
async function nameOf(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return "";
    const data = (await res.json()) as { address?: string; parts?: { street?: string; area?: string } };
    return cleanPlaceLabel(data.parts?.street || data.parts?.area || data.address?.split(",")[0] || "");
  } catch {
    return "";
  }
}

/**
 * "Where is it?" for an alert (optional), as in the app: type a street, landmark or area and we find
 * it, or click the map / drag the pin. The map shows the spot and its name before posting.
 */
export function AlertPlaceField({ value, onChange }: { value: AlertPlace | null; onChange: (place: AlertPlace | null) => void }) {
  const hood = useNeighbourhood();
  const [open, setOpen] = useState(!!value);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lng, lat] = hood?.location?.coordinates ?? [];
  if (lat === undefined || lng === undefined || !hood) return null;
  const centre = { lat, lng };
  const point = value ?? centre;
  const inReach = alertPlaceInReach(centre, hood.radiusMeters, point);

  const place = async (p: { lat: number; lng: number }, label?: string) => {
    onChange({ lat: p.lat, lng: p.lng, ...(value?.label && !label && { label: value.label }), ...(label && { label }) });
    if (!label && !value?.label) {
      const found = await nameOf(p.lat, p.lng);
      if (found) onChange({ lat: p.lat, lng: p.lng, label: found });
    }
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const params = new URLSearchParams({ street: q, area: hood.name, city: hood.city ?? "" });
      const res = await fetch(`/api/geocode?${params}`);
      if (!res.ok) {
        setNote("We couldn't find that. Try a nearby street or landmark, or click the map where it is.");
        return;
      }
      const found = (await res.json()) as { lat: number; lng: number; precision: "street" | "area" };
      await place(found, cleanPlaceLabel(q));
      if (found.precision === "area") setNote(`We found ${hood.name}, not that exact spot. Drag the pin onto it.`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left text-sm hover:bg-muted/50"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <span>
          <span className="block font-semibold">Add the place</span>
          <span className="block text-xs text-muted-foreground">Optional. Type the street or area, or pin it on the map.</span>
        </span>
      </button>
    );
  }

  return (
    <fieldset className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold">Where is it happening?</legend>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden /> Remove place
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="A street, landmark or area"
          aria-label="Find a street, landmark or area"
          className={fieldInputClass}
        />
        <Button type="button" variant="outline" onClick={() => void search()} loading={busy}>
          <Search className="size-4" aria-hidden /> Find
        </Button>
      </div>
      <div className="relative h-56 overflow-hidden rounded-lg border border-border">
        <LocationMap lat={point.lat} lng={point.lng} onPick={(p) => void place(p)} />
      </div>
      <p className="text-xs text-muted-foreground">Click the map or drag the pin to the spot.</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <input
        value={value?.label ?? ""}
        onChange={(e) => onChange({ lat: point.lat, lng: point.lng, label: e.target.value.slice(0, ALERT_PLACE_LABEL_MAX) })}
        placeholder="Name the place, e.g. Allen Avenue roundabout"
        aria-label="The place's name"
        className={fieldInputClass}
      />
      {!inReach && <p className="text-xs font-semibold text-destructive">That&apos;s too far from {hood.name}. Alerts are for what&apos;s happening nearby.</p>}
    </fieldset>
  );
}
