import { cn } from "@myhoodora/ui/utils";

type Tone = "green" | "amber" | "coral" | "red" | "grey" | "teal";

/**
 * One status → one word → one colour, everywhere in the admin
 * (docs/archive/2026-09-29-admin-target-architecture.md §8).
 */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  // accounts
  active: { label: "Active", tone: "green" },
  restricted: { label: "Restricted", tone: "red" },
  suspended: { label: "Suspended", tone: "red" },
  // verification
  verified: { label: "Verified", tone: "green" },
  unverified: { label: "Unverified", tone: "grey" },
  pending_review: { label: "Needs review", tone: "amber" },
  failed: { label: "Check failed", tone: "amber" },
  rejected: { label: "Rejected", tone: "grey" },
  // reports
  open: { label: "Open", tone: "amber" },
  under_review: { label: "Under review", tone: "teal" },
  escalated: { label: "Escalated", tone: "coral" },
  resolved: { label: "Resolved", tone: "grey" },
  upheld: { label: "Upheld", tone: "grey" },
  overturned: { label: "Overturned", tone: "teal" },
  dismissed: { label: "Dismissed", tone: "grey" },
  // content
  visible: { label: "Visible", tone: "green" },
  removed: { label: "Removed", tone: "red" },
  sold: { label: "Sold", tone: "grey" },
  archived: { label: "Archived", tone: "grey" },
  paused: { label: "Paused", tone: "amber" },
  // alerts
  urgent: { label: "Urgent", tone: "red" },
  ended: { label: "Ended", tone: "grey" },
  // businesses
  applied: { label: "New application", tone: "amber" },
  info_requested: { label: "Info requested", tone: "amber" },
  // inbox
  waiting: { label: "Waiting on neighbour", tone: "teal" },
  // severity
  high: { label: "High", tone: "red" },
  medium: { label: "Medium", tone: "amber" },
  low: { label: "Low", tone: "grey" },
  // roles
  owner: { label: "Owner", tone: "teal" },
  admin: { label: "Admin", tone: "teal" },
  moderator: { label: "Moderator", tone: "teal" },
  member: { label: "Member", tone: "grey" },
};

const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  coral: "bg-brand-coral/10 text-[#c2412f] ring-brand-coral/25",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  grey: "bg-muted text-muted-foreground ring-border",
  teal: "bg-primary/10 text-primary ring-primary/20",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: "grey" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        TONE[s.tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? s.label}
    </span>
  );
}
