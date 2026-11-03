export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const label =
    mins < 1 ? "just now" : mins < 60 ? `${mins}m` : mins < 60 * 24 ? `${Math.round(mins / 60)}h` : mins < 60 * 24 * 30 ? `${Math.round(mins / 1440)}d` : `${Math.round(mins / 43200)}mo`;
  if (label === "just now") return label;
  return future ? `in ${label}` : `${label} ago`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function naira(n: number | null): string {
  return n === null ? "Free" : `₦${n.toLocaleString("en-NG")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const REASON_LABEL: Record<string, string> = {
  harassment: "Harassment or hate",
  scam: "Scam or fraud",
  misinformation: "Misinformation",
  spam: "Spam or advertising",
  not_local: "Not about the neighbourhood",
  other: "Something else",
};

export const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  recommendation: "Recommendation",
  for_sale: "For sale",
  alert: "Alert",
  event: "Event",
  lost_found: "Lost & found",
  thanks: "Thanks",
  poll: "Poll",
};
