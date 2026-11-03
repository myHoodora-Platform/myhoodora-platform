"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Info } from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import type { HoodDetail } from "@/lib/api/admin/types";
import { createProblem, hoodPlacement, resizeProblem } from "@/lib/hood-placement";
import { CentreFields, parseCentre } from "./centre-fields";
import { useHoodsAround } from "./use-hoods-around";

const HoodMap = dynamic(() => import("./hood-map").then((m) => m.HoodMap), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted sm:h-72" /> });

type BoundaryPatch = { center?: { lat: number; lng: number }; radiusMeters?: number; reason?: string };

/**
 * Move a Hood's centre and change its radius, on a map. The same checks as the API (§28), shown while
 * the admin places the circle: a moved centre is checked like a new Hood's, a larger radius like a resize.
 */
export function HoodBoundaryDialog({ hood, onClose, onSave }: { hood: HoodDetail; onClose: () => void; onSave: (patch: BoundaryPatch) => Promise<void> }) {
  const current = { lat: String(hood.center.lat), lng: String(hood.center.lng) };
  const [centre, setCentre] = useState(current);
  const [radius, setRadius] = useState(hood.radiusMeters);
  const point = parseCentre(centre);
  const around = useHoodsAround(point ?? undefined, hood.id);

  const moved = point !== null && (point.lat !== hood.center.lat || point.lng !== hood.center.lng);
  const resized = radius !== hood.radiusMeters;
  // Like the API, the checks ignore archived Hoods; the map still draws them.
  const placement = point && hoodPlacement({ name: hood.name, center: point, radiusMeters: radius }, around.filter((h) => h.status !== "archived"));
  const problem = placement && (moved ? createProblem(placement) : radius > hood.radiusMeters ? resizeProblem(placement) : null);

  return (
    <ActionDialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${hood.name}'s boundary`}
      consequence="Changes apply straight away, for address checks from now on; existing members stay. Hoods can overlap, but not over another Hood's centre."
      confirmLabel="Save boundary"
      requireReason={false}
      ready={point !== null && (moved || resized) && !problem}
      onConfirm={({ note }) => onSave({ ...(moved && point && { center: point }),...(resized && { radiusMeters: radius }), reason: note })}
    >
      <div className="overflow-hidden rounded-xl border border-border">
        {point ? (
          <HoodMap lat={point.lat} lng={point.lng} radiusMeters={radius} others={around} onPick={(p) => setCentre({ lat: String(p.lat), lng: String(p.lng) })} className="h-64 w-full sm:h-72" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-muted text-sm text-muted-foreground sm:h-72">Enter a valid centre point</div>
        )}
      </div>
      <CentreFields value={centre} onChange={setCentre} idPrefix="boundary" />
      {moved && (
        <button type="button" onClick={() => setCentre(current)} className="text-sm font-semibold text-primary hover:underline">
          Put the centre back where it was
        </button>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Radius: {(radius / 1000).toFixed(1)} km</span>
        <input type="range" min={300} max={6000} step={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
      </label>
      {problem ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {problem}
        </p>
      ) : (
        placement &&
        placement.sharesWith.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            Shares ground with {placement.sharesWith.map((h) => h.name).join(", ")}. Addresses there join the Hood on their side of the dashed line.
          </p>
        )
      )}
    </ActionDialog>
  );
}
