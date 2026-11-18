import type { Viewer } from "../../shared/auth/viewer";

/**
 * The official myHoodora Hood Team account (docs/product/hood-activation-plan.md §4).
 *
 * One system account that posts welcome posts, conversation starters, local information and daily
 * prompts into Hoods, so a new neighbour never arrives to an empty feed. It is never presented as a
 * neighbour: everything it writes carries the "Official · Hood Team" label (author kind "team").
 *
 * Nobody can sign in to it: its uid is not a Firebase uid, and it has no Hood of its own.
 */
export const HOOD_TEAM_UID = "myhoodora-hood-team";

export const HOOD_TEAM_PROFILE = {
  displayName: "myHoodora Hood Team",
  /** Never emailed: a reserved, undeliverable address (RFC 2606 `.invalid`). */
  email: "hood-team@myhoodora.invalid",
  bio: "Official account. We share local information and questions to get neighbours talking. This space belongs to the neighbours.",
} as const;

/** The Hood Team's photo: the app icon, like every official myHoodora surface. */
export function hoodTeamPhotoUrl(appUrl: string): string {
  return appIconUrl(appUrl);
}

/** The app icon (apps/web/public/logo/app-icon.png, from the mobile app's icon): official myHoodora notices. */
export function appIconUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/logo/app-icon.png`;
}

export function isHoodTeam(uid: string | undefined | null): boolean {
  return uid === HOOD_TEAM_UID;
}

/**
 * The Hood Team as the author of a post in one Hood: what PostsService.create checks against. It can
 * write in any Hood it is given, but only through hood-content (staff tools), never a public route.
 */
export function hoodTeamViewer(hoodId: string): Viewer {
  return {
    uid: HOOD_TEAM_UID,
    emailVerified: true,
    displayName: HOOD_TEAM_PROFILE.displayName,
    role: "member",
    accountStatus: "active",
    verificationStatus: "verified",
    hoodId,
    readableHoodIds: [hoodId],
    capabilities: ["content.create", "content.react"],
    exists: true,
    ageConfirmed: true,
  };
}
