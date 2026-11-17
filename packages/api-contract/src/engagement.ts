/**
 * Streaks, the launch challenge and avatar badges (contract §42; plan WP-C).
 */
export type StreakTier = "bronze" | "silver" | "gold";
export const STREAK_TIER_AT: Record<StreakTier, number> = { bronze: 3, silver: 7, gold: 30 };
/** The ring around the badge, per tier; a Hood Builder without a streak gets the brand green. */
export const TIER_RING: Record<StreakTier | "builder", string> = { bronze: "#b87333", silver: "#9ea7b3", gold: "#e8b923", builder: "#1f8a4c" };

/** On avatars (post and comment authors, profiles): the Hood Builder mascot, and the streak tier's ring. */
export interface AvatarBadge {
  builder?: true;
  tier?: StreakTier;
  /** Days, from 3. */
  streak?: number;
}

/** "Hood Builder · 12-day streak". */
export function badgeLabel(b: AvatarBadge | null | undefined): string | null {
  if (!b) return null;
  const parts = [b.builder ? "Hood Builder" : null, b.streak ? `${b.streak}-day streak` : b.tier ? `${b.tier[0]!.toUpperCase()}${b.tier.slice(1)} streak` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** GET /engagement/me. */
export interface EngagementSummary {
  streak: { current: number; best: number; tier: StreakTier | null; activeToday: boolean; toNextTier: number | null } | null;
  challenge: {
    name: string;
    startsAt: string;
    endsAt: string | null;
    active: boolean;
    minInvites: number;
    minActiveDays: number;
    invites: number;
    activeDays: number;
    builder: boolean;
    builderSince: string | null;
  } | null;
  badge: AvatarBadge | null;
}

/** GET /admin/engagement. */
export interface EngagementAdmin {
  settings: { challengeName: string; challengeStartsAt: string; challengeEndsAt: string | null; minInvites: number; minActiveDays: number; streaksOn: boolean; badgesOn: boolean };
  counts: { builders: number; buildersByStaff: number; streaks: Record<StreakTier, number> };
}

/** GET /admin/engagement/builders. */
export interface BuilderRow {
  uid: string;
  displayName: string;
  hood?: string;
  since: string;
  by: "auto" | "staff";
  invites: number;
  activeDays: number;
}

/**
 * The slim strip at the top of the feed (web and app): what's going on with the challenge and your
 * streak, in a line, opening the Invite page. Null when there's nothing to say (no streak, and no
 * challenge running), so the feed stays quiet.
 */
export function challengeStrip(e: EngagementSummary | null | undefined): { title: string; detail: string } | null {
  if (!e) return null;
  const s = e.streak && e.streak.current > 0 ? e.streak : null;
  const c = e.challenge;
  const streak = s ? `${s.current}-day streak${s.activeToday ? " ✓" : ""}` : null;
  if (c?.active && !c.builder) {
    return {
      title: "Become a Hood Builder",
      detail: `${Math.min(c.invites, c.minInvites)} of ${c.minInvites} invites · ${Math.min(c.activeDays, c.minActiveDays)} of ${c.minActiveDays} days`,
    };
  }
  if (c?.builder && (c.active || streak)) return { title: "You're a Hood Builder", detail: streak ? `${streak} · invite neighbours` : "Invite neighbours to grow your Hood" };
  if (streak) return { title: streak, detail: s!.activeToday ? "Done for today. See you tomorrow!" : "Post, reply, vote or RSVP today to keep it going" };
  return null;
}

/** Today's date in Lagos (WAT, UTC+1), e.g. "2026-11-17": "hide until tomorrow" keys on it. */
export function lagosToday(now = Date.now()): string {
  return new Date(now + 3_600_000).toISOString().slice(0, 10);
}
