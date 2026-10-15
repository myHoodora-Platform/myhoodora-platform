"use client";

import { Field, fieldInputClass } from "@/components/shared/field";

export type CentreText = { lat: string; lng: string };

/** The point typed into CentreFields, or null while it isn't a valid one. */
export function parseCentre({ lat, lng }: CentreText): { lat: number; lng: number } | null {
  if (!lat.trim() || !lng.trim()) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? point : null;
}

/** "6.4478, 3.4746", as Google Maps and most map apps copy a point. */
const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * A Hood's centre as latitude and longitude. Pasting "lat, lng" into either box fills both. Pair it with
 * a HoodMap given `onPick`, so the admin can set the point on the map instead.
 */
export function CentreFields({ value, onChange, idPrefix = "h" }: { value: CentreText; onChange: (next: CentreText) => void; idPrefix?: string }) {
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pair = PAIR.exec(e.clipboardData.getData("text"));
    if (!pair) return;
    e.preventDefault();
    onChange({ lat: pair[1]!, lng: pair[2]! });
  };
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Centre latitude" htmlFor={`${idPrefix}-lat`}>
          <input id={`${idPrefix}-lat`} inputMode="decimal" value={value.lat} onChange={(e) => onChange({ ...value, lat: e.target.value })} onPaste={onPaste} className={fieldInputClass} />
        </Field>
        <Field label="Centre longitude" htmlFor={`${idPrefix}-lng`}>
          <input id={`${idPrefix}-lng`} inputMode="decimal" value={value.lng} onChange={(e) => onChange({ ...value, lng: e.target.value })} onPaste={onPaste} className={fieldInputClass} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Click the map or drag the pin to set the centre, or paste “lat, lng” copied from Google Maps.</p>
    </div>
  );
}
