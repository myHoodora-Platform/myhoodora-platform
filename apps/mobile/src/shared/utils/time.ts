/** "now", "5m", "3h", "2d", then a short date: the web feed's style. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(then).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "October 2026", or null for a date it can't read. */
export function monthYear(iso?: string): string | null {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : null;
}
