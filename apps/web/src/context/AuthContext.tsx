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
import { onIdTokenChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import {
  fetchUserProfile,
  completeOnboardingApi,
  verifyLocationApi,
  updateProfileApi,
  revokeBackendSession,
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
  loading: boolean;
  authReady: boolean;
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isGatingModalOpen, setIsGatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Which account the current `profile` belongs to, so a failed refresh can
  // keep showing it (same account) but never leak it to another account.
  const profileUidRef = useRef<string | null>(null);
  // Bumped per profile request / sign-out; only the latest response may land.
  const requestSeqRef = useRef(0);

  const acceptProfile = useCallback((uid: string, data: unknown) => {
    const next = parseProfile(data);
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
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      // Auth state is resolved here — flip this fast so header/UI can render
      // the correct logged-in/logged-out state without waiting for the
      // session-cookie + profile network round-trips below.
      setAuthReady(true);
      if (firebaseUser) {
        // The cookie only gates server routing; failing to set it must not
        // stop the profile from loading.
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });
        } catch (err) {
          console.error("Failed to update session cookie:", err);
        }
        await loadProfile(firebaseUser);
      } else {
        requestSeqRef.current++; // drop any in-flight profile response
        profileUidRef.current = null;
        setProfile(null);
        setProfileError(null);
        setProfileStatus("idle");
        // Drafts hold home addresses; don't leave them for the next person.
        clearAllOnboardingDrafts();
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
          });
        } catch (err) {
          console.error("Failed to clear session cookie on logout:", err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

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

  const logout = async () => {
    // Revoke the Firebase refresh token server-side while the bearer token
    // is still valid — signOut() below discards it, and this call would
    // fail (401) if attempted after.
    if (user) {
      try {
        await revokeBackendSession(user);
      } catch (err) {
        console.error("Failed to revoke session on server:", err);
      }
    }

    await logoutUser();
    // Don't leave this neighbourhood's cached posts on a shared device.
    clearFeedCaches();
    clearAllOnboardingDrafts();
    // Explicitly await the cookie clear rather than relying on the
    // onIdTokenChanged listener's side effect above, which races with any
    // navigation the caller does right after this resolves.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Failed to clear session cookie on logout:", err);
    }
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
        loading,
        authReady,
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
