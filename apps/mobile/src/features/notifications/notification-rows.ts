import type { AppNotification } from "@myhoodora/api-contract/types";

const DAY = 86_400_000;

export interface NotificationSection {
  title: string;
  data: AppNotification[];
}

/**
 * Unread first under "New", then the rest by age: Today, This week, This month, Earlier.
 * Empty sections are left out; order within each stays newest first, as the API sends it.
 */
export function sectionNotifications(rows: AppNotification[], now = Date.now()): NotificationSection[] {
  const buckets: NotificationSection[] = [
    { title: "New", data: [] },
    { title: "Today", data: [] },
    { title: "This week", data: [] },
    { title: "This month", data: [] },
    { title: "Earlier", data: [] },
  ];
  for (const n of rows) {
    const age = now - new Date(n.createdAt).getTime();
    const at = !n.read ? 0 : age < DAY ? 1 : age < 7 * DAY ? 2 : age < 30 * DAY ? 3 : 4;
    buckets[at]!.data.push(n);
  }
  return buckets.filter((s) => s.data.length);
}

/** "now", "5m", "3h", "2d", "3w", "1y": the compact age a notification row shows. */
export function shortAge(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const m = Math.floor(Math.max(0, now - then) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 365)}y`;
}

/**
 * The title split so the people's names can be bold: "Tunde and 2 others" | " reacted to your post".
 * Everything is `rest` when the title doesn't start with the latest person's name.
 */
export function titleParts(n: Pick<AppNotification, "title" | "actors" | "actorCount">): { names: string; rest: string } {
  const [latest, second] = n.actors ?? [];
  if (!latest || !n.title.startsWith(latest.displayName)) return { names: "", rest: n.title };
  const others = (n.actorCount ?? 1) - 1;
  const tail = others === 1 && second ? ` and ${second.displayName}` : others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : "";
  const names = n.title.startsWith(`${latest.displayName}${tail}`) ? `${latest.displayName}${tail}` : latest.displayName;
  return { names, rest: n.title.slice(names.length) };
}
