/** Seasons are set in Lagos time (WAT, UTC+1, no daylight saving), whatever the admin's own clock says. */
const WAT_MS = 60 * 60 * 1000;

/** ISO instant → "2026-12-15T00:00" for a datetime-local input, in Lagos time. */
export function toLagosInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + WAT_MS).toISOString().slice(0, 16) : "";
}

/** "2026-12-15T00:00" read as Lagos time → ISO instant (null when empty or invalid). */
export function fromLagosInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}:00Z`);
  return Number.isFinite(t) ? new Date(t - WAT_MS).toISOString() : null;
}

/** "Mon 15 Dec, 00:00" in Lagos time. */
export function lagosLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
