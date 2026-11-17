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
