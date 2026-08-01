"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { fetchUserProfile, completeOnboardingApi } from "@/lib/firebase/auth";

interface UserProfile {
  isOnboarded: boolean;
  displayName?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isGatingModalOpen: boolean;
  setIsGatingModalOpen: (open: boolean) => void;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  }) => Promise<void>;
  runGatedAction: (action: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGatingModalOpen, setIsGatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const refreshProfile = async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    try {
      const data = await fetchUserProfile(auth.currentUser);
      setProfile(data as UserProfile);
    } catch (err) {
      console.error("Failed to refresh user profile from backend:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });

          const data = await fetchUserProfile(firebaseUser);
          setProfile(data as UserProfile);
        } catch (err) {
          console.error(
            "Failed to fetch user profile or update session cookie:",
            err,
          );
          setProfile(null);
        }
      } else {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
          });
        } catch (err) {
          console.error("Failed to clear session cookie on logout:", err);
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const completeOnboarding = async (payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  }) => {
    if (!user) throw new Error("No authenticated user session found.");
    const updatedProfile = await completeOnboardingApi(user, payload);
    setProfile(updatedProfile as UserProfile);
  };

  const runGatedAction = (action: () => void) => {
    if (profile?.isOnboarded) {
      action();
    } else {
      setPendingAction(() => action);
      setIsGatingModalOpen(true);
    }
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
        loading,
        isGatingModalOpen,
        setIsGatingModalOpen,
        refreshProfile,
        completeOnboarding,
        runGatedAction,
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
