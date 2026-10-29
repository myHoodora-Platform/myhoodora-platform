"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { hoodsNear, listHoods } from "@/lib/api/admin/community";
import { formatDistance } from "@/lib/format";
import { distanceMeters } from "@/lib/geo";

export interface HoodChoice {
  id: string;
  name: string;
  city?: string;
}

const PAGE_SIZE = 25;
const NEAREST_SHOWN = 5;

/**
 * Choose a Hood from all of them: searched on the server, paged with "Load more", and (given the
 * neighbour's pin) the nearest ones first. `currentId` is shown but can't be chosen (moving Hood).
 */
export function HoodPicker({
  value,
  onChange,
  preset,
  currentId,
  near,
}: {
  value: string;
  onChange: (hood: HoodChoice) => void;
  /** The Hood already chosen when the dialog opens, so its name shows before any list loads. */
  preset?: HoodChoice;
  currentId?: string;
  near?: { lat: number; lng: number };
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const term = q.trim();
  const [items, setItems] = useState<HoodChoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const [nearest, setNearest] = useState<(HoodChoice & { distanceMeters: number })[]>([]);
  const [chosen, setChosen] = useState<HoodChoice | undefined>(preset);

  useEffect(() => setChosen(preset), [preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- a new preset, not a new object

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setState("loading");
    // Typing waits for a pause; paging and retrying don't.
    const t = setTimeout(
      () => {
        listHoods(user, { q: term || undefined, page, pageSize: PAGE_SIZE, sort: "name:asc" })
          .then((p) => {
            if (!alive) return;
            const rows = p.items.map((h) => ({ id: h.id, name: h.name, city: h.city }));
            setItems((prev) => (page === 1 ? rows : [...prev, ...rows]));
            setTotal(p.total);
            setState("ready");
          })
          .catch((err) => {
            console.error("Couldn't load Hoods:", err);
            if (alive) setState("error");
          });
      },
      page === 1 && term ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [user, term, page, attempt]);

  useEffect(() => {
    if (!user || !near) return;
    let alive = true;
    hoodsNear(user, near)
      .then((hoods) => {
        if (!alive) return;
        setNearest(
          hoods
            .filter((h) => h.status !== "archived")
            .map((h) => ({ id: h.id, name: h.name, city: h.city, distanceMeters: distanceMeters(near, h.center) }))
            .sort((a, b) => a.distanceMeters - b.distanceMeters)
            .slice(0, NEAREST_SHOWN),
        );
      })
      // The full list still works without them.
      .catch((err) => console.error("Couldn't load nearby Hoods:", err));
    return () => {
      alive = false;
    };
  }, [user, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- the point, not the object

  const pick = (h: HoodChoice) => {
    setChosen(h);
    onChange(h);
  };

  const option = (h: HoodChoice, detail?: string) => {
    const isCurrent = h.id === currentId;
    const selected = h.id === value;
    return (
      <li key={h.id}>
        <button
          type="button"
          onClick={() => pick(h)}
          disabled={isCurrent}
          aria-pressed={selected}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50",
            selected && "bg-primary/10 hover:bg-primary/10",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">{h.name}</span>
            <span className="block text-xs text-muted-foreground">
              {[h.city, detail, isCurrent && "current Hood"].filter(Boolean).join(" · ")}
            </span>
          </span>
          {selected && <Check className="size-4 shrink-0 text-primary" aria-label="Chosen" />}
        </button>
      </li>
    );
  };

  const showNearest = !term && nearest.length > 0;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold">Hood</span>
      {value && (
        <p className="text-sm">
          Chosen: <span className="font-semibold">{chosen?.id === value ? [chosen.name, chosen.city].filter(Boolean).join(", ") : "1 Hood"}</span>
        </p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // A new search starts again from the first page.
            setPage(1);
          }}
          placeholder="Search Hoods by name or city"
          aria-label="Search Hoods"
          className={cn(fieldInputClass, "pl-9")}
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border p-1">
        {showNearest && (
          <>
            <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">Nearest to their pin</p>
            <ul>{nearest.map((h) => option(h, `${formatDistance(Math.round(h.distanceMeters))} away`))}</ul>
            <p className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground">All Hoods</p>
          </>
        )}
        {state === "error" && items.length === 0 ? (
          <div className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
            <span className="text-muted-foreground">Couldn&apos;t load Hoods.</span>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : state === "loading" && page === 1 ? (
          <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading Hoods…
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{term ? <>No Hoods match &ldquo;{term}&rdquo;.</> : "No Hoods yet."}</p>
        ) : (
          <>
            <ul>{items.map((h) => option(h))}</ul>
            {items.length < total && (
              <button
                type="button"
                onClick={() => (state === "error" ? setAttempt((n) => n + 1) : setPage((p) => p + 1))}
                disabled={state === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-muted/50 disabled:opacity-60"
              >
                {state === "loading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {state === "error" ? "Couldn't load more. Try again" : `Load more (${total - items.length} more)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
