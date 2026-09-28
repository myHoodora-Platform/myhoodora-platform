const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** null → "Free". */
export function formatNaira(amount: number | null): string {
  return amount === null ? "Free" : naira.format(amount);
}

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Parts for a calendar-style date badge. */
export function dateBadge(iso: string): { month: string; day: string; weekday: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleString("en-NG", { month: "short" }).toUpperCase(),
    day: String(date.getDate()),
    weekday: date.toLocaleString("en-NG", { weekday: "short" }),
  };
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { month: "long", year: "numeric" });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
