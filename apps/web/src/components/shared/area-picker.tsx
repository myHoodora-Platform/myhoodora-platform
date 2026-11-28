"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { fieldInputClass } from "@/components/shared/field";
import { FilterChips } from "@/components/shared/filter-chips";
import { useCoverage } from "@/lib/api/use-coverage";
import { searchAreas, toggleArea } from "@/lib/area-search";
import { coverageStates } from "@/lib/coverage";

/** Matches shown at once while searching: enough to scan, and typing more narrows it. */
const MAX_HITS = 30;
const ALL = "__all";

interface AreaPickerProps {
  value: string[];
  onChange: (areas: string[]) => void;
  /** The API takes up to 20. */
  max?: number;
  error?: string;
  className?: string;
}

/**
 * Choose Hoods from the live list: search by Hood, city or state, or browse city by city. Built for a few
 * hundred Hoods, where a wall of chips stops working.
 */
export function AreaPicker({ value, onChange, max = 20, error, className }: AreaPickerProps) {
  const id = useId();
  const { cities, total } = useCoverage();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<string>(ALL);

  const states = useMemo(() => coverageStates(cities), [cities]);
  const hoodCount = total ?? cities.reduce((n, c) => n + c.areas.length, 0);
  const inState = state === ALL ? null : state;
  const hits = useMemo(() => searchAreas(cities, query, inState), [cities, query, inState]);
  const browsing = useMemo(() => cities.filter((c) => !inState || c.state === inState), [cities, inState]);
  const full = value.length >= max;
  const searching = query.trim().length > 0;

  const toggle = (area: string) => onChange(toggleArea(value, area, max));
  const chip = (area: string, sub?: string) => {
    const on = value.includes(area);
    return (
      <button
        key={area}
        type="button"
        aria-pressed={on}
        disabled={!on && full}
        onClick={() => toggle(area)}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
        )}
      >
        {on && <Check className="size-3.5 shrink-0" aria-hidden />}
        <span>
          {area}
          {sub && <span className="font-normal text-muted-foreground"> · {sub}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {value.length} of {max} chosen
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Neighbourhoods chosen">
            {value.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  aria-label={`Remove ${a}`}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {a} <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${hoodCount} Hoods, e.g. Bodija or Sango-Ota`}
          aria-label="Search neighbourhoods"
          aria-describedby={`${id}-status`}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className={cn(fieldInputClass, "pl-10")}
        />
      </div>

      {states.length > 1 && (
        <FilterChips
          label="State"
          active={state}
          onSelect={setState}
          items={[{ id: ALL, label: "All states" }, ...states.map((s) => ({ id: s, label: s }))]}
        />
      )}

      <p id={`${id}-status`} aria-live="polite" className="text-xs text-muted-foreground">
        {full
          ? `That's the most you can choose (${max}). Remove one to pick another.`
          : searching
            ? hits.length === 0
              ? `No Hood matches “${query.trim()}”. Try another spelling, or the area next to it.`
              : hits.length > MAX_HITS
                ? `Showing ${MAX_HITS} of ${hits.length} matches. Keep typing to narrow it down.`
                : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`
            : "Search, or open a city to see its Hoods."}
      </p>

      {searching ? (
        <div className="flex flex-wrap gap-2">{hits.slice(0, MAX_HITS).map((h) => chip(h.area, h.city))}</div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {browsing.map((c) => {
            const chosen = c.areas.filter((a) => value.includes(a)).length;
            return (
              <details key={`${c.state}/${c.city}`} className="group" open={browsing.length === 1}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="font-bold">{c.city}</span>
                  {c.state && c.state !== c.city && <span className="text-muted-foreground">{c.state}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {chosen > 0 && <span className="font-semibold text-primary">{chosen} chosen · </span>}
                    {c.areas.length} {c.areas.length === 1 ? "Hood" : "Hoods"}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="flex flex-wrap gap-2 px-4 pb-4">{c.areas.map((a) => chip(a))}</div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
