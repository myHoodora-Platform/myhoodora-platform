/**
 * Invite codes and referral paths (contract §40; docs/product/hood-activation-plan.md WP-E). Every
 * neighbour has a short code ("ADA7K"); every way of bringing someone in carries it, and ends in
 * POST /invites/claim once they've signed up. Only invitees who verify their address count.
 */

/** How the invite reached them: their link, a shared post, a badge card, a group link, a QR poster, typed in, or "Who invited you?". */
export const INVITE_VIAS = ["link", "post", "badge", "group", "qr", "code", "asked"] as const;
export type InviteVia = (typeof INVITE_VIAS)[number];

/** The query parameter every shared link carries. */
export const INVITE_REF_PARAM = "ref";
/** The first code a person arrives with is kept this long (then a newer one may replace it). */
export const INVITE_REF_KEEP_DAYS = 30;
/** Verified invites for the Builder badge: 5 (raised from Nextdoor's Top Inviters 3 on 17 Nov 2026). Admins can change it per challenge. */
export const BUILDER_INVITES = 5;

/** What someone typed or a link carried → the code, or null. */
export function normaliseInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const c = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{4,10}$/.test(c) ? c : null;
}

/** The personal invite link's path. */
export const invitePath = (code: string) => `/i/${code}`;

/** `path` with `?ref=<code>` added (or replacing one), keeping any other query and the #hash. */
export function withInviteRef(path: string, code: string | null | undefined): string {
  if (!code) return path;
  const [beforeHash, hash] = path.split("#", 2) as [string, string | undefined];
  const [base, query = ""] = beforeHash.split("?", 2) as [string, string | undefined];
  // Plain strings: this package runs everywhere, without URLSearchParams.
  const kept = query.split("&").filter((p) => p && p.split("=")[0] !== INVITE_REF_PARAM);
  kept.push(`${INVITE_REF_PARAM}=${encodeURIComponent(code)}`);
  return `${base}?${kept.join("&")}${hash !== undefined ? `#${hash}` : ""}`;
}

/** GET /invites/me. */
export interface InviteSummary {
  code: string;
  /** Absolute personal link: https://myhoodora.com/i/<code>. */
  link: string;
  joined: number;
  /** Joined and verified their address: the ones that count. */
  verified: number;
  verifiedInMyHood: number;
  /** Newest 20; short names ("Ada O."); the Hood once verified. */
  people: { name: string; hoodName?: string; verified: boolean; joinedAt: string }[];
  invitedBy: { name: string } | null;
  /** Show "Who invited you?" (joined since the challenge began, hasn't answered or closed it). */
  askWhoInvited: boolean;
}

/** GET /public/invites/:code (no sign-in): the invite landing page. */
export interface PublicInvite {
  code: string;
  inviter: { firstName: string };
  hood: { name: string; city?: string } | null;
}

/** POST /invites/claim. Either a code or (from "Who invited you?") a neighbour in their Hood. */
export interface ClaimInviteInput {
  code?: string;
  uid?: string;
  via: InviteVia;
  /** This phone's or browser's own random id (only a hash is kept, to spot invite farming). */
  device?: string;
}

/** GET /admin/invites (staff). */
export interface InviteLeaderboard {
  totals: { joined: number; verified: number };
  /** `flagged`: their invitees that look like one person and haven't been reviewed (GET /admin/invites/flags). */
  people: { uid: string; displayName: string; code?: string; hood?: { id: string; name: string }; joined: number; verified: number; flagged: number }[];
  hoods: { id: string; name: string; joined: number; verified: number }[];
}

/**
 * Why an invite looks like one person: claimed on the inviter's own phone, several from one phone, or a
 * crowd from one network (an estate's Wi-Fi can be fine). Only hashes are compared.
 */
export type InviteFlagReason = "same_device_as_inviter" | "shared_device" | "shared_network";

export const INVITE_FLAG_LABELS: Record<InviteFlagReason, string> = {
  same_device_as_inviter: "Same phone as the inviter",
  shared_device: "Several sign-ups from one phone",
  shared_network: "Many sign-ups from one network",
};

/** GET /admin/invites/flags. */
export interface InviteFlagGroup {
  inviter: { uid: string; displayName: string; code?: string };
  reasons: InviteFlagReason[];
  invitees: { uid: string; displayName: string; joinedAt: string; verified: boolean; reasons: InviteFlagReason[] }[];
}

/** GET /admin/invites/people/:uid. */
export interface StaffInviteView {
  code: string | null;
  invitedBy: { uid: string; displayName: string; code: string; via: InviteVia; at: string; vouched: boolean; changedByStaff: boolean; reviewed: boolean } | null;
  flags: InviteFlagReason[];
  joined: number;
  verified: number;
}

/**
 * The note shown when someone shares a post only their Hood can read (plan WP-G): people outside will
 * see a preview. Null when the post is for Nearby Hoods or Anyone, or a safety alert is the Hood's own anyway.
 */
export function shareNote(post: { visibility?: string | null; category?: string; author?: { neighborhoodName?: string } }, hoodName?: string): string | null {
  if (post.visibility && post.visibility !== "neighbourhood") return null;
  const hood = hoodName ?? post.author?.neighborhoodName ?? "your neighbourhood";
  return post.category === "alert"
    ? `Shared. Safety alerts stay in ${hood}: people outside see only that there was one.`
    : `Shared. People outside ${hood} will see a preview only. Pick “Anyone” when you post to let everyone read it.`;
}
