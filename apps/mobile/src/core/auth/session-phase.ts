import type { UserProfile } from "@myhoodora/api-contract/types";

/**
 * Where the app is in the session lifecycle (ADR-003). The splash screen stays up while
 * bootstrapping, so protected screens never flash; a failed profile load is not "signed out".
 */
export type SessionPhase =
  | "bootstrapping" // Firebase hasn't said who is signed in yet, or the intro flag isn't read yet
  | "intro" // a fresh install (or cleared app data), signed out: the intro slides come first
  | "signedOut"
  | "profileLoading" // signed in; GET /users/me in flight
  | "profileError" // signed in, but the profile couldn't be loaded (offline, 5xx): retry, stay signed in
  | "needsOnboarding" // signed in, profile says not onboarded (and they haven't chosen "Skip for now")
  | "ready";

export type ProfileStatus = "idle" | "loading" | "ready" | "error";

export interface SessionInputs {
  authReady: boolean;
  /** null while it is being read. */
  introSeen: boolean | null;
  signedIn: boolean;
  profileStatus: ProfileStatus;
  profile: UserProfile | null;
  /** Chose "Skip for now" on this phone: into the app with limited access, as on the web. */
  onboardingSkipped?: boolean;
}

export function sessionPhase({ authReady, introSeen, signedIn, profileStatus, profile, onboardingSkipped = false }: SessionInputs): SessionPhase {
  if (!authReady || introSeen === null) return "bootstrapping";
  if (!signedIn) return introSeen ? "signedOut" : "intro";
  // A profile already on screen stays usable while a refresh is in flight or has failed.
  if (profile) return profile.isOnboarded || onboardingSkipped ? "ready" : "needsOnboarding";
  if (profileStatus === "error") return "profileError";
  return "profileLoading";
}

/** Joined their Hood: verified, with a Hood to read. Onboarded people who skipped or await review are not. */
export function hasHood(profile: UserProfile | null): profile is UserProfile & { neighborhoodId: string } {
  return !!profile?.neighborhoodId && profile.verificationStatus === "verified";
}

/** Created in the last minute: the first profile load is what sets the account up (docs/authentication.md). */
export function isNewAccount(user: { metadata: { creationTime?: string } } | null, now = Date.now()): boolean {
  const created = Date.parse(user?.metadata.creationTime ?? "");
  return Number.isFinite(created) && now - created < 60_000;
}
