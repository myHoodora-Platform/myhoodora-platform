"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

/** Consistent list toolbar: search on the left, filters, result count on the right. */
export function AdminToolbar({ children, count, className }: { children: React.ReactNode; count?: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 sm:gap-3", className)}>
      {children}
      {count && <p className="w-full text-xs font-medium text-muted-foreground sm:ml-auto sm:w-auto">{count}</p>}
    </div>
  );
}

/** Debounced search that writes to the URL through `onSearch`. */
export function SearchBox({ value, onSearch, placeholder }: { value: string; onSearch: (q: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onSearch(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft, value, onSearch]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-card pr-9 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onSearch("");
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 rounded-xl border bg-card px-3 pr-8 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
          value ? "border-primary/40 text-primary" : "border-border",
        )}
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Status tabs above a list, with optional counts. */
export function StatusTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((t) => {
        const on = t.value === active;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("rounded-full px-1.5 text-xs", on ? "bg-primary/10" : "bg-muted")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
