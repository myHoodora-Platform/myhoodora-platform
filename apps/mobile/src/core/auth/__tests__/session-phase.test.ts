import type { UserProfile } from "@myhoodora/api-contract/types";
import { FOREGROUND_REFRESH_MS, foregroundRefreshDue, hasHood, isNewAccount, sessionPhase } from "../session-phase";

const onboarded: UserProfile = { isOnboarded: true, neighborhoodId: "h1", verificationStatus: "verified" };

describe("sessionPhase", () => {
  it("waits for Firebase before deciding anything (no flash of the login or the feed)", () => {
    expect(sessionPhase({ introSeen: true, authReady: false, signedIn: false, profileStatus: "idle", profile: null })).toBe("bootstrapping");
    expect(sessionPhase({ introSeen: true, authReady: false, signedIn: true, profileStatus: "ready", profile: onboarded })).toBe("bootstrapping");
  });

  it("shows the intro first on a fresh install, and waits until the flag is read", () => {
    expect(sessionPhase({ introSeen: false, authReady: true, signedIn: false, profileStatus: "idle", profile: null })).toBe("intro");
    expect(sessionPhase({ introSeen: null, authReady: true, signedIn: false, profileStatus: "idle", profile: null })).toBe("bootstrapping");
  });

  it("signed out once Firebase says nobody is signed in", () => {
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: false, profileStatus: "idle", profile: null })).toBe("signedOut");
  });

  it("a failed profile load is an error to retry, never 'signed out'", () => {
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "loading", profile: null })).toBe("profileLoading");
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "error", profile: null })).toBe("profileError");
  });

  it("sends people who haven't onboarded to onboarding, and keeps a loaded profile usable during a refresh", () => {
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "ready", profile: { isOnboarded: false } })).toBe("needsOnboarding");
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "ready", profile: onboarded })).toBe("ready");
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "error", profile: onboarded })).toBe("ready");
  });

  it("asks for the date of birth before anything else, and 'Skip for now' doesn't get round it", () => {
    const base = { introSeen: true, authReady: true, signedIn: true, profileStatus: "ready" as const };
    expect(sessionPhase({ ...base, profile: { isOnboarded: false, ageConfirmed: false } })).toBe("needsAgeCheck");
    expect(sessionPhase({ ...base, profile: { ...onboarded, ageConfirmed: false }, onboardingSkipped: true })).toBe("needsAgeCheck");
    expect(sessionPhase({ ...base, profile: { isOnboarded: false, ageConfirmed: true } })).toBe("needsOnboarding");
  });

  it("a closed account shows Welcome back before anything else: signing in doesn't reopen it", () => {
    const base = { introSeen: true, authReady: true, signedIn: true, profileStatus: "ready" as const };
    expect(sessionPhase({ ...base, profile: { ...onboarded, closure: { kind: "deactivated", since: "2026-11-01T10:00:00.000Z" } } })).toBe("closed");
    const deleting = { kind: "deleting" as const, since: "2026-11-01T10:00:00.000Z", deleteAt: "2026-11-08T10:00:00.000Z" };
    expect(sessionPhase({ ...base, profile: { isOnboarded: false, ageConfirmed: false, closure: deleting } })).toBe("closed");
    expect(sessionPhase({ ...base, profile: { ...onboarded, closure: null } })).toBe("ready");
  });

  it("asks for the current terms after the age check, and 'Skip for now' doesn't get round it", () => {
    const base = { introSeen: true, authReady: true, signedIn: true, profileStatus: "ready" as const };
    const never = { terms: null, privacy: null };
    expect(sessionPhase({ ...base, profile: { isOnboarded: false, legal: never } })).toBe("needsTerms");
    expect(sessionPhase({ ...base, profile: { ...onboarded, legal: { terms: "2026-09-28", privacy: "2026-11-03" } }, onboardingSkipped: true })).toBe("needsTerms");
    expect(sessionPhase({ ...base, profile: { isOnboarded: false, ageConfirmed: false, legal: never } })).toBe("needsAgeCheck");
    expect(sessionPhase({ ...base, profile: { ...onboarded, legal: { terms: "2026-11-03", privacy: "2026-11-07" } } })).toBe("ready");
    // An older API that doesn't report it: not asked.
    expect(sessionPhase({ ...base, profile: onboarded })).toBe("ready");
  });

  it("'Skip for now' lets someone in with limited access, as on the web", () => {
    expect(sessionPhase({ introSeen: true, authReady: true, signedIn: true, profileStatus: "ready", profile: { isOnboarded: false }, onboardingSkipped: true })).toBe("ready");
  });
});

describe("isNewAccount", () => {
  const now = Date.parse("2026-10-22T10:00:00Z");
  it("is true only for an account created in the last minute", () => {
    expect(isNewAccount({ metadata: { creationTime: "Thu, 22 Oct 2026 09:59:30 GMT" } }, now)).toBe(true);
    expect(isNewAccount({ metadata: { creationTime: "Thu, 22 Oct 2026 09:30:00 GMT" } }, now)).toBe(false);
    expect(isNewAccount({ metadata: {} }, now)).toBe(false);
    expect(isNewAccount(null, now)).toBe(false);
  });
});

describe("hasHood", () => {
  it("only a verified neighbour with a Hood reads a feed", () => {
    expect(hasHood(onboarded)).toBe(true);
    expect(hasHood({ ...onboarded, verificationStatus: "pending_review" })).toBe(false);
    expect(hasHood({ isOnboarded: true, verificationStatus: "verified" })).toBe(false);
    expect(hasHood(null)).toBe(false);
  });
});

describe("foregroundRefreshDue", () => {
  it("reloads the profile on return to the app, at most once per window", () => {
    expect(foregroundRefreshDue(true, 0, FOREGROUND_REFRESH_MS)).toBe(true);
    expect(foregroundRefreshDue(true, 1_000, 1_000 + FOREGROUND_REFRESH_MS - 1)).toBe(false);
    expect(foregroundRefreshDue(true, 1_000, 1_000 + FOREGROUND_REFRESH_MS)).toBe(true);
  });

  it("waits for the first profile load instead (no profile on screen yet)", () => {
    expect(foregroundRefreshDue(false, 0, 10 * FOREGROUND_REFRESH_MS)).toBe(false);
  });
});
