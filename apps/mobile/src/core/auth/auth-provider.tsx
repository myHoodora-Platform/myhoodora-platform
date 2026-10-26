import { onAuthStateChanged, signOut, type User } from "@firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { ApiError, FRIENDLY_MESSAGES } from "@myhoodora/api-contract/errors";
import type { UserProfile } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch, setUnauthorizedHandler } from "@/core/api/client";
import { firebaseAuth } from "@/core/firebase/auth";
import { setMonitoringUser } from "@/core/monitoring/monitoring";
import { hasSeenIntro, markIntroSeen, resetIntro } from "@/core/intro/intro-flag";
import { noteFirstRunEligibility } from "@/core/onboarding/first-run";
import { clearDraft, hasSkippedOnboarding, markOnboardingSkipped } from "@/core/onboarding/onboarding-store";
import { unregisterPush } from "@/core/push/push";
import { sessionPhase, type ProfileStatus, type SessionPhase } from "./session-phase";

interface AuthContextValue {
  phase: SessionPhase;
  user: User | null;
  profile: UserProfile | null;
  profileError: ApiError | null;
  /** Reload `GET /users/me` (after onboarding, a Hood move, a `session.changed`). False if it failed. */
  refreshProfile: () => Promise<boolean>;
  /** This phone only; other devices stay signed in. */
  logout: () => Promise<void>;
  /** Every device. Throws, signing nothing out, if the API can't be reached. */
  logoutEverywhere: () => Promise<void>;
  /** The intro slides are done (or skipped): never show them again on this install. */
  finishIntro: () => Promise<void>;
  /** Show the intro again now (testing, outside production). Only while signed out. */
  replayIntro: () => Promise<void>;
  /** "Skip for now" on onboarding: into the app with limited access, remembered for this account. */
  skipOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function asProfile(data: unknown): UserProfile {
  if (data && typeof data === "object" && typeof (data as { isOnboarded?: unknown }).isOnboarded === "boolean") return data as UserProfile;
  throw new ApiError(FRIENDLY_MESSAGES.server, 200, "server");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  // Ignore a profile response that arrives after the person changed (signed out, or someone else signed in).
  const currentUid = useRef<string | null>(null);

  const loadProfile = useCallback(async (who: User): Promise<boolean> => {
    setProfileStatus("loading");
    try {
      // The first call creates the record for a new Google account (docs/authentication.md).
      const [data, skipped] = await Promise.all([apiFetch<unknown>(who, "/users/me"), hasSkippedOnboarding(who.uid)]);
      const next = asProfile(data);
      if (currentUid.current !== who.uid) return false;
      await noteFirstRunEligibility(who.uid, next);
      setOnboardingSkipped(skipped);
      setProfile(next);
      setProfileError(null);
      setProfileStatus("ready");
      return true;
    } catch (err) {
      if (currentUid.current !== who.uid) return false;
      setProfileError(err instanceof ApiError ? err : new ApiError(FRIENDLY_MESSAGES.server, 0, "server"));
      setProfileStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    void hasSeenIntro().then(setIntroSeen);
  }, []);

  // A fresh install that still finds a session: the iOS Keychain keeps it after the app is deleted.
  // Someone reinstalling (or who cleared the app's data) starts from the intro and logs in again.
  useEffect(() => {
    if (introSeen === false && authReady && user) void signOut(firebaseAuth());
  }, [introSeen, authReady, user]);

  const finishIntro = useCallback(async () => {
    await markIntroSeen();
    setIntroSeen(true);
  }, []);

  const replayIntro = useCallback(async () => {
    await resetIntro();
    setIntroSeen(false);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (next) => {
      currentUid.current = next?.uid ?? null;
      setMonitoringUser(next?.uid ?? null);
      setUser(next);
      setProfile(null);
      setProfileError(null);
      setProfileStatus("idle");
      setAuthReady(true);
      if (next) void loadProfile(next);
    });
  }, [loadProfile]);

  const logout = useCallback(async () => {
    const who = firebaseAuth().currentUser;
    // Stop pushes to this phone while the token still proves who we are.
    if (who) await unregisterPush(who).catch(() => undefined);
    // An unfinished onboarding draft holds a home address: never leave it for the next person.
    if (who) await clearDraft(who.uid);
    await signOut(firebaseAuth());
    // So the next "Continue with Google" offers the account chooser again, as the web does.
    await GoogleSignin.signOut().catch(() => undefined);
    queryClient.clear();
  }, [queryClient]);

  const logoutEverywhere = useCallback(async () => {
    const who = firebaseAuth().currentUser;
    if (!who) return;
    // The API revokes every session and removes every phone's push registration.
    await apiFetch<void>(who, "/auth/logout-everywhere", { method: "POST" });
    await clearDraft(who.uid);
    await signOut(firebaseAuth());
    queryClient.clear();
  }, [queryClient]);

  // A 401 means the session is over (revoked, disabled, expired beyond refresh).
  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    return () => setUnauthorizedHandler(undefined);
  }, [logout]);

  const skipOnboarding = useCallback(async () => {
    if (!user) return;
    await markOnboardingSkipped(user.uid);
    setOnboardingSkipped(true);
  }, [user]);

  const refreshProfile = useCallback(async () => (user ? loadProfile(user) : false), [user, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      phase: sessionPhase({ authReady, introSeen, signedIn: !!user, profileStatus, profile, onboardingSkipped }),
      user,
      profile,
      profileError,
      refreshProfile,
      logout,
      logoutEverywhere,
      finishIntro,
      replayIntro,
      skipOnboarding,
    }),
    [authReady, introSeen, user, profileStatus, profile, profileError, onboardingSkipped, refreshProfile, logout, logoutEverywhere, finishIntro, replayIntro, skipOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

/** For screens that only render when signed in (inside the protected stack). */
export function useSignedInUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useSignedInUser outside the signed-in stack");
  return user;
}
