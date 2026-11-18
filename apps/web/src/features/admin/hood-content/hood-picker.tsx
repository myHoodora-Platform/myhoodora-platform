"use client";

import { useMemo, useState } from "react";
import type { HoodTarget } from "@myhoodora/api-contract/hood-content";
import { cn } from "@myhoodora/ui/utils";
import { fieldInputClass } from "@/components/shared/field";
import type { AdminHood } from "@/lib/api/admin/types";

export type PickerMode = "all" | "cities" | "hoods";

export interface HoodChoice {
  mode: PickerMode;
  cities: string[];
  hoodIds: string[];
}

export const EMPTY_CHOICE: HoodChoice = { mode: "all", cities: [], hoodIds: [] };

export function toTarget(c: HoodChoice): HoodTarget | null {
  if (c.mode === "all") return { allHoods: true };
  if (c.mode === "cities") return c.cities.length ? { cities: c.cities } : null;
  return c.hoodIds.length ? { hoodIds: c.hoodIds } : null;
}

/** The Hoods a choice covers, for counts and the preview. */
export function hoodsFor(c: HoodChoice, hoods: AdminHood[]): AdminHood[] {
  if (c.mode === "all") return hoods;
  if (c.mode === "cities") return hoods.filter((h) => c.cities.includes(h.city));
  return hoods.filter((h) => c.hoodIds.includes(h.id));
}

/** All open Hoods, the open Hoods in some cities, or chosen Hoods (searchable). */
export function HoodPicker({ hoods, value, onChange, idPrefix }: { hoods: AdminHood[] | null; value: HoodChoice; onChange: (c: HoodChoice) => void; idPrefix: string }) {
  const [q, setQ] = useState("");
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of hoods ?? []) counts.set(h.city, (counts.get(h.city) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [hoods]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (hoods ?? []).filter((h) => !needle || `${h.name} ${h.city}`.toLowerCase().includes(needle)).slice(0, 200);
  }, [hoods, q]);

  if (!hoods) return <p className="text-sm text-muted-foreground">Loading Hoods…</p>;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const count = hoodsFor(value, hoods).length;

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">Which Hoods</legend>
      <div role="radiogroup" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["all", `All open Hoods (${hoods.length})`],
            ["cities", "By city"],
            ["hoods", "Choose Hoods"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.mode === mode}
            onClick={() => onChange({ ...value, mode })}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", value.mode === mode ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {value.mode === "cities" && (
        <div className="flex flex-wrap gap-2">
          {cities.map(([city, n]) => (
            <label key={city} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", value.cities.includes(city) ? "border-primary bg-primary/10 text-primary" : "border-border")}>
              <input type="checkbox" className="size-4" checked={value.cities.includes(city)} onChange={() => onChange({ ...value, cities: toggle(value.cities, city) })} />
              {city} <span className="text-muted-foreground">({n})</span>
            </label>
          ))}
        </div>
      )}

      {value.mode === "hoods" && (
        <div className="space-y-2">
          <input id={`${idPrefix}-hood-search`} aria-label="Search Hoods" placeholder="Search Hoods" value={q} onChange={(e) => setQ(e.target.value)} className={fieldInputClass} />
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {shown.map((h) => (
              <li key={h.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                  <input type="checkbox" className="size-4" checked={value.hoodIds.includes(h.id)} onChange={() => onChange({ ...value, hoodIds: toggle(value.hoodIds, h.id) })} />
                  <span className="min-w-0 flex-1 truncate">
                    {h.name} <span className="text-muted-foreground">· {h.city}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{h.stats.members} neighbours</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {count} Hood{count === 1 ? "" : "s"} selected.
      </p>
    </fieldset>
  );
}
