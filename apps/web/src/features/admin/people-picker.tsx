"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { listNeighbours } from "@/lib/api/admin/community";
import type { NeighbourSummary } from "@/lib/api/admin/types";

export type Person = Pick<NeighbourSummary, "uid" | "displayName" | "hood">;

/** Search neighbours by name or email and collect up to `max` of them (Broadcasts, New conversation). */
export function PeoplePicker({ people, onChange, max = 1 }: { people: Person[]; onChange: (p: Person[]) => void; max?: number }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const term = q.trim();

  useEffect(() => {
    if (!user || term.length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    setSearching(true);
    setFailed(false);
    const t = setTimeout(() => {
      listNeighbours(user, { q: term, pageSize: 8 })
        .then(
          (page) =>
            alive &&
            setResults(
              page.items.map((n) => ({
                uid: n.uid,
                displayName: n.displayName,
                hood: n.hood,
              })),
            ),
        )
        .catch(() => alive && setFailed(true))
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [user, term]);

  const chosen = new Set(people.map((p) => p.uid));
  const add = (p: Person) => {
    if (chosen.has(p.uid) || people.length >= max) return;
    onChange([...people, p]);
    setQ("");
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Recipients">
          {people.map((p) => (
            <li
              key={p.uid}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-1 pr-1 pl-3 text-xs font-semibold text-primary"
            >
              {p.displayName}
              {p.hood && <span className="font-normal text-primary/70">· {p.hood.name}</span>}
              <button
                type="button"
                onClick={() => onChange(people.filter((x) => x.uid !== p.uid))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/15"
                aria-label={`Remove ${p.displayName}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {people.length < max && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search neighbours by name or email"
            aria-label="Search neighbours"
            className={cn(fieldInputClass, "pl-9")}
          />
        </div>
      )}
      {term.length >= 2 && (
        <div className="max-h-56 overflow-y-auto">
          {searching && !results ? (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : failed ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Search didn&apos;t work. Try again in a moment.</p>
          ) : results && results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">No neighbours match &ldquo;{term}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(results ?? []).map((p) => (
                <li key={p.uid}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={chosen.has(p.uid)}
                    className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-muted/40 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.displayName}</span>
                      <span className="block text-xs text-muted-foreground">{p.hood?.name ?? "No Hood yet"}</span>
                    </span>
                    {chosen.has(p.uid) ? (
                      <Check className="size-4 shrink-0 text-primary" aria-label="Added" />
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-primary">Add</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {people.length === 0 && term.length < 2 && <p className="text-xs text-muted-foreground">Type at least 2 letters of a name or email.</p>}
    </div>
  );
}
