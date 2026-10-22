import type { UserProfile } from "@myhoodora/api-contract/types";
import { hasHood, isNewAccount, sessionPhase } from "../session-phase";

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
