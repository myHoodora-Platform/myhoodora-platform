"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { onIdTokenChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import {
  fetchUserProfile,
  completeOnboardingApi,
  verifyLocationApi,
  updateProfileApi,
  revokeAllSessionsApi,
  logoutUser,
  requestHoodApi,
  cancelHoodRequestApi,
} from "@/lib/firebase/auth";
import type { VerifyLocationResult } from "@/lib/api/types";
import { ApiError, FRIENDLY_MESSAGES } from "@/lib/api/client";
import {
  parseProfile,
  toApiError,
  type ProfileStatus,
  type UserProfile,
} from "@/lib/auth/profile";
import { clearAllOnboardingDrafts } from "@/features/onboarding/draft";
import { clearFeedCaches } from "@/features/feed/feed-cache";
import { noteTourEligibility } from "@/features/tour/storage";
import { clearMemoryCaches } from "@/lib/memory-cache";
import { clearServerSession, syncServerSession } from "@/lib/auth/session-sync";
import { isSessionOnlyPath } from "@/lib/routes";

export type { ProfileStatus, UserProfile } from "@/lib/auth/profile";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  /**
   * Whether `profile` can be trusted. Check this before treating a missing
   * profile as "not onboarded": `error` means the API failed, not that the
   * account is new.
   */
  profileStatus: ProfileStatus;
  /** Why the last profile load failed (kept even if a stale profile is still shown). */
  profileError: ApiError | null;
  /**
   * Still settling: the first auth state, the server session and the profile
   * (or, after a sign-out, the cookie being cleared). Wait for it before
   * deciding someone is signed out.
   */
  loading: boolean;
  /** Firebase has said who (if anyone) is signed in. Enough to draw signed-in or signed-out UI. */
  authReady: boolean;
  /**
   * The server session cookie is in place for `user`, so the proxy will
   * serve protected pages. Firebase restoring a user is not enough to
   * navigate into the app: wait for this, or `ensureSession()`.
   */
  sessionReady: boolean;
  /**
   * Makes sure the server session matches the signed-in user (again, if the
   * cookie went missing while this tab was open). Resolves true once
   * protected pages will load.
   */
  ensureSession: () => Promise<boolean>;
  isGatingModalOpen: boolean;
  setIsGatingModalOpen: (open: boolean) => void;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  }) => Promise<void>;
  verifyLocation: (coords: { lat: number; lng: number }) => Promise<VerifyLocationResult>;
  /** Ask to join a nearby Hood (address outside every Hood). Staff approve it. */
  requestHood: (hoodId: string) => Promise<void>;
  /** Withdraw a pending join request. */
  cancelHoodRequest: () => Promise<void>;
  /** Your Hood only changes through verification or staff, never here. */
  updateProfile: (payload: { displayName?: string }) => Promise<void>;
  runGatedAction: (action: () => void) => void;
  /** Signs out this browser only; other devices stay signed in. */
  logout: () => Promise<void>;
  /** Signs out every device, this one included. Throws (and signs nothing out) if the server can't be reached. */
  logoutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isGatingModalOpen, setIsGatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Which account the current `profile` belongs to, so a failed refresh can
  // keep showing it (same account) but never leak it to another account.
  const profileUidRef = useRef<string | null>(null);
  // Bumped per profile request / sign-out; only the latest response may land.
  const requestSeqRef = useRef(0);
  // Which account the server session was last confirmed for.
  const sessionUidRef = useRef<string | null>(null);
  // What this tab knows about the session cookie (it is HttpOnly, so this is
  // inferred): "present" once someone has been signed in here, "cleared" once
  // we removed it, "unknown" for a visitor we've only seen signed out.
  const [serverSession, setServerSession] = useState<"unknown" | "present" | "cleared">("unknown");
  const pathname = usePathname();

  // Firebase is the source of truth: signed out there, the server session has
  // to go too, or the proxy would keep treating them as signed in (and send
  // /login straight back into the app). That is the case when someone was
  // signed in here, or when the proxy has just served a page it only serves
  // with a session. An anonymous visitor on a public page has nothing to clear.
  const staleSession =
    authReady && !user && (serverSession === "present" || (serverSession === "unknown" && isSessionOnlyPath(pathname)));
  useEffect(() => {
    if (staleSession) void clearServerSession().then(() => setServerSession("cleared"));
  }, [staleSession]);

  const acceptProfile = useCallback((uid: string, data: unknown) => {
    const next = parseProfile(data);
    noteTourEligibility(uid, next);
    profileUidRef.current = uid;
    setProfile(next);
    setProfileError(null);
    setProfileStatus("ready");
  }, []);

  // 401 from our API: the session is gone (revoked, password changed,
  // account deleted). Sign out properly so every screen sends them to
  // login, instead of carrying on with a signed-in shell and no profile.
  const endExpiredSession = useCallback(async () => {
    toast.error(FRIENDLY_MESSAGES.auth, { id: "session-expired" });
    try {
      await logoutUser();
    } catch (err) {
      console.error("Failed to sign out after session expiry:", err);
    }
  }, []);

  const ensureSession = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return false;
    const result = await syncServerSession(current);
    // Signed out or switched account while we waited: this answer is about someone else.
    if (auth.currentUser?.uid !== current.uid) return false;
    if (result === "ok") {
      sessionUidRef.current = current.uid;
      setSessionReady(true);
      return true;
    }
    if (result === "rejected") await endExpiredSession();
    // "unavailable": leave things as they are. A session confirmed earlier is
    // probably still good, and the next token refresh or navigation retries.
    return false;
  }, [endExpiredSession]);

  const loadProfile = useCallback(
    async (firebaseUser: User) => {
      const seq = ++requestSeqRef.current;
      if (profileUidRef.current !== firebaseUser.uid) {
        // Different account (or first load): nothing trustworthy to show yet.
        profileUidRef.current = null;
        setProfile(null);
        setProfileStatus("loading");
      }
      try {
        const data = await fetchUserProfile(firebaseUser);
        if (seq !== requestSeqRef.current) return;
        acceptProfile(firebaseUser.uid, data);
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        const apiErr = toApiError(err);
        console.error("Failed to load user profile:", err);
        if (apiErr.kind === "auth") {
          await endExpiredSession();
          return;
        }
        setProfileError(apiErr);
        // Same account (e.g. the hourly token refresh hit a blip): keep the
        // profile we already have. Otherwise surface an error state — never
        // an empty profile, which would read as "not onboarded".
        if (profileUidRef.current !== firebaseUser.uid) setProfileStatus("error");
      }
    },
    [acceptProfile, endExpiredSession],
  );

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setProfile(null);
      setProfileStatus("idle");
      return;
    }
    await loadProfile(current);
  }, [loadProfile]);

  useEffect(() => {
    // Fires on sign-in, sign-out and each (roughly hourly) token refresh, in
    // every tab: the one place the server session is kept in step.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // A different account's session says nothing about this one.
        if (sessionUidRef.current !== firebaseUser.uid) setSessionReady(false);
        // Auth state is resolved here — flip this fast so header/UI can render
        // the correct logged-in/logged-out state without waiting for the
        // session-cookie + profile network round-trips below.
        setAuthReady(true);
        setServerSession("present");
        // Independent of each other: the cookie only gates server routing, and
        // failing to set it must not stop the profile from loading.
        await Promise.all([ensureSession(), loadProfile(firebaseUser)]);
      } else {
        sessionUidRef.current = null;
        setSessionReady(false);
        setAuthReady(true);
        requestSeqRef.current++; // drop any in-flight profile response
        profileUidRef.current = null;
        setProfile(null);
        setProfileError(null);
        setProfileStatus("idle");
        // Drafts hold home addresses and caches hold messages: don't leave them for the next person.
        clearAllOnboardingDrafts();
        clearMemoryCaches();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ensureSession, loadProfile]);

  useEffect(() => {
    // When a page is restored from the browser's back-forward cache, its
    // React state is frozen from before navigation — if auth/profile
    // changed elsewhere in the meantime (e.g. logged out in another tab),
    // this re-syncs it without needing a full reload.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void refreshProfile();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [refreshProfile]);

  // Writes that return the updated profile. A 401 ends the session like a
  // failed load does; every error is rethrown for the caller to show.
  const withSessionCheck = async <T,>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request();
    } catch (err) {
      if (err instanceof ApiError && err.kind === "auth") await endExpiredSession();
      throw err;
    }
  };

  const completeOnboarding = async (payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  }) => {
    if (!user) throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
    const updatedProfile = await withSessionCheck(() => completeOnboardingApi(user, payload));
    acceptProfile(user.uid, updatedProfile);
  };

  const verifyLocation = async (coords: { lat: number; lng: number }) => {
    if (!user) throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
    const result = await withSessionCheck(() => verifyLocationApi(user, coords));
    await refreshProfile();
    return result;
  };

  const requestHood = async (hoodId: string) => {
    if (!user) throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
    const updatedProfile = await withSessionCheck(() => requestHoodApi(user, hoodId));
    acceptProfile(user.uid, updatedProfile);
  };

  const cancelHoodRequest = async () => {
    if (!user) throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
    const updatedProfile = await withSessionCheck(() => cancelHoodRequestApi(user));
    acceptProfile(user.uid, updatedProfile);
  };

  const updateProfile = async (payload: { displayName?: string }) => {
    if (!user) throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
    const updatedProfile = await withSessionCheck(() => updateProfileApi(user, payload));
    acceptProfile(user.uid, updatedProfile);
  };

  // Signs out this browser only: their phone and other browsers stay signed
  // in. (Ending every session is the API's POST /auth/logout-everywhere.)
  const logout = async () => {
    await logoutUser();
    // Don't leave this neighbourhood's cached posts on a shared device.
    clearFeedCaches();
    clearAllOnboardingDrafts();
    // Signing out already triggers this (see `staleSession`), but nothing
    // awaits that: wait here so the navigation that follows can't race it.
    await clearServerSession();
  };

  // Their choice in Settings, e.g. after losing a phone. The server goes
  // first: if it can't revoke the sessions, nothing here pretends it did.
  const logoutEverywhere = async () => {
    if (!user) return;
    await revokeAllSessionsApi(user);
    await logout();
  };

  const runGatedAction = (action: () => void) => {
    if (profile?.isOnboarded) {
      action();
      return;
    }
    if (profile && profileStatus === "ready") {
      setPendingAction(() => action);
      setIsGatingModalOpen(true);
      return;
    }
    // We don't know yet whether they're onboarded (still loading, or the
    // profile request failed). Say so and retry — don't send an existing
    // neighbour back through onboarding.
    toast.error(
      profileStatus === "error"
        ? "We couldn't load your account. Please try again in a moment."
        : "Still loading your account. Please try again in a moment.",
      { id: "profile-unavailable" },
    );
    if (profileStatus === "error") void refreshProfile();
  };

  // If gating modal is open, and user subsequently completes onboarding, we can execute the pending action.
  useEffect(() => {
    if (profile?.isOnboarded && pendingAction) {
      pendingAction();
      setPendingAction(null);
      setIsGatingModalOpen(false);
    }
  }, [profile?.isOnboarded, pendingAction]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileStatus,
        profileError,
        // Until a stale cookie is gone, nothing may redirect to /login: the
        // proxy would still treat them as signed in.
        loading: loading || staleSession,
        authReady,
        sessionReady,
        ensureSession,
        isGatingModalOpen,
        setIsGatingModalOpen,
        refreshProfile,
        completeOnboarding,
        verifyLocation,
        requestHood,
        cancelHoodRequest,
        updateProfile,
        runGatedAction,
        logout,
        logoutEverywhere,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
