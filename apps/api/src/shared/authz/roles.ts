/**
 * Roles and capabilities — the single source of truth for "who may do what".
 * Mirrors docs/api-contract.md §13.1 (+ owner). Controllers declare the
 * capability they need with @Can(); services use `can()` for record-level
 * rules. Nothing else in the codebase compares role strings.
 */

export const ROLES = ["member", "moderator", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "restricted", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending_review", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type Capability =
  // Everyone signed in (not suspended)
  | "profile.manage"
  // Verified, active neighbours with a Hood
  | "content.create"
  | "content.react"
  | "report.create"
  /** Verified neighbours, including restricted ones (restriction stops posting, not messaging). */
  | "messages.send"
  // Staff
  | "admin.access"
  | "moderation.act"
  | "moderation.suspend"
  | "verification.review"
  /** See a neighbour's home address on their staff profile (contract §13.3: admins only). */
  | "neighbours.address"
  | "hoods.manage"
  | "businesses.review"
  | "broadcasts.send"
  | "team.manage"
  | "settings.manage"
  // Owner only: grant/revoke admin
  | "team.manage.admins";

const STAFF: Record<Exclude<Role, "member">, Capability[]> = {
  moderator: ["admin.access", "moderation.act", "verification.review"],
  admin: [
    "admin.access",
    "moderation.act",
    "moderation.suspend",
    "verification.review",
    "neighbours.address",
    "hoods.manage",
    "businesses.review",
    "broadcasts.send",
    "team.manage",
    "settings.manage",
  ],
  owner: [
    "admin.access",
    "moderation.act",
    "moderation.suspend",
    "verification.review",
    "neighbours.address",
    "hoods.manage",
    "businesses.review",
    "broadcasts.send",
    "team.manage",
    "settings.manage",
    "team.manage.admins",
  ],
};

export interface CapabilitySubject {
  role: Role;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  hoodId?: string | null;
  restrictedUntil?: Date | null;
}

/** Restriction ends automatically once `restrictedUntil` has passed. */
export function effectiveAccountStatus(s: Pick<CapabilitySubject, "accountStatus" | "restrictedUntil">, now = new Date()): AccountStatus {
  if (s.accountStatus === "restricted" && s.restrictedUntil && s.restrictedUntil <= now) return "active";
  return s.accountStatus;
}

/** Everything this person may do right now, given role AND account state. */
export function capabilitiesOf(s: CapabilitySubject, now = new Date()): Capability[] {
  const status = effectiveAccountStatus(s, now);
  if (status === "suspended") return [];
  const caps: Capability[] = ["profile.manage"];
  if (s.verificationStatus === "verified" && s.hoodId) caps.push("messages.send");
  if (status === "active" && s.verificationStatus === "verified" && s.hoodId) {
    caps.push("content.create", "content.react", "report.create");
  } else if (status === "active") {
    // Unverified neighbours can still report harmful content they see.
    caps.push("report.create");
  }
  if (s.role !== "member") caps.push(...STAFF[s.role]);
  return caps;
}

export function can(s: CapabilitySubject, capability: Capability, now = new Date()): boolean {
  return capabilitiesOf(s, now).includes(capability);
}

/** Staff roles only, in ascending power — used when changing roles. */
export const ROLE_RANK: Record<Role, number> = { member: 0, moderator: 1, admin: 2, owner: 3 };

export function isStaff(role: Role): boolean {
  return role !== "member";
}
