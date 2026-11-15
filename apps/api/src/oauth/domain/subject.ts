import { effectiveAccountStatus } from "../../shared/authz/roles";
import type { User } from "../../users/schemas/user.schema";

/** An account's state as myHoodora AI may know it (contract §7.1). Nothing else about the person. */
export interface SubjectSnapshot {
  sub: string;
  status: "active" | "restricted" | "suspended" | "deactivated" | "deleted";
  email: string;
  email_verified: boolean;
  age_band: "adult";
  /** §5.4: the myHoodoraAI operator role, or null. */
  ai_role: "operator" | null;
  updated_at: string;
}

export function subjectStatus(
  user: Pick<
    User,
    "purgedAt" | "deactivatedAt" | "accountStatus" | "restrictedUntil"
  >,
  now = new Date(),
): SubjectSnapshot["status"] {
  if (user.purgedAt) return "deleted";
  // Closed by its owner, being deleted, or closed as under 18: all "deactivated" from the outside.
  if (user.deactivatedAt) return "deactivated";
  const status = effectiveAccountStatus(user, now);
  return status === "suspended"
    ? "suspended"
    : status === "restricted"
      ? "restricted"
      : "active";
}

export function subjectSnapshot(
  user: User,
  sub: string,
  now = new Date(),
): SubjectSnapshot {
  return {
    sub,
    status: subjectStatus(user, now),
    email: user.email,
    email_verified: Boolean(user.emailVerifiedAt),
    // Only adults ever get a sign-in code (contract §4.2), so everyone linked is one.
    age_band: "adult",
    ai_role: user.aiOperator ? "operator" : null,
    updated_at: (user.updatedAt ?? now).toISOString(),
  };
}
