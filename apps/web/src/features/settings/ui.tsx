"use client";

import { cn } from "@myhoodora/ui/utils";

/** A titled group of settings (one card per concern). */
export function SettingsSection({
  title,
  description,
  children,
  className,
  tone,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card",
        tone === "danger" ? "border-destructive/30" : "border-border",
        className,
      )}
    >
      <header className="border-b border-border px-4 py-3.5 sm:px-5">
        <h2 className={cn("text-base font-bold", tone === "danger" && "text-destructive")}>{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** One row: label + description on the left, control on the right. On a phone a wide control wraps below the text. */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  htmlFor?: string;
  children?: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 basis-56">
        <Label {...(htmlFor ? { htmlFor } : {})} className="block text-[15px] font-semibold text-foreground">
          {label}
        </Label>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
    </div>
  );
}

/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

/** Segmented single choice (radio group styled as pills). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
            value === o.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
