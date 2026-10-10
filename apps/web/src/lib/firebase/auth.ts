import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./config";
import { USE_MOCKS, isLive } from "@/lib/api/config";
import { ApiError, FRIENDLY_MESSAGES, apiFetch } from "@/lib/api/client";
import type { NearbyHood, VerifyLocationResult } from "@/lib/api/types";
import { distanceMeters } from "@/lib/geo";
import { load, save } from "@/lib/api/mock/store";
import { MOCK_HOOD_RADIUS_M, MOCK_NEARBY_HOODS, MOCK_NEARBY_LIMIT_M, MOCK_NEIGHBORHOOD } from "@/lib/api/mock/seed";
import { hasSkippedOnboarding } from "@/features/onboarding/draft";
import { isStaff } from "@/lib/auth/profile";
import { DEFAULT_APP_ROUTE, ROUTES } from "@/lib/routes";
import { requireServerSession } from "@/lib/auth/session-sync";

// ── Mock mode (NEXT_PUBLIC_USE_MOCKS=true) ──────────────────────────────────
// Firebase sign-in stays real; everything our API would return is served
// from the in-browser store so the app runs with no backend/DB.
// A brand-new account starts exactly like the real API's: not onboarded, not
// verified and in no neighbourhood, so sign-up always goes through
// /onboarding. verifyLocationApi / completeOnboardingApi fill the rest in.
function mockProfile(user: User) {
  return load<Record<string, unknown>>(`profile:${user.uid}`, () => ({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "Neighbour",
    isOnboarded: false,
    verificationStatus: "unverified",
    accountStatus: "active",
    emailVerified: true,
    role: "member",
  }));
}

function updateMockProfile(user: User, patch: Record<string, unknown>) {
  const next = { ...mockProfile(user), ...patch };
  save(`profile:${user.uid}`, next);
  return next;
}

/**
 * Where to send someone right after they sign in: straight to onboarding
 * until they've finished it (Nextdoor-style), unless they already chose
 * "Skip for now" for limited access.
 *
 * Staff who aren't residents (no onboarding) skip it and go where they were
 * headed, or to the admin when they just opened /login. Staff who are also
 * onboarded residents land like everyone else.
 *
 * GET /users/me also creates the account on first sign-in. If it fails, the
 * person is still signed in, so send them on to `fallback`: the app shell
 * shows a "couldn't load your account" state with Retry, rather than guessing
 * they're new and sending them through onboarding.
 *
 * Every destination is behind the proxy, so this also waits for the server
 * session. Without one it throws (a readable ApiError) instead of returning
 * a page that would only bounce them back to login.
 */
export async function routeAfterSignIn(user: User, fallback: string): Promise<string> {
  const [, profile] = await Promise.all([
    requireServerSession(user),
    (fetchUserProfile(user) as Promise<{ isOnboarded?: boolean; role?: string } | null>).catch((err) => {
      console.error("Couldn't load profile after sign-in:", err);
      return null;
    }),
  ]);
  if (profile && profile.isOnboarded === false) {
    if (isStaff(profile.role)) return fallback === DEFAULT_APP_ROUTE ? ROUTES.admin : fallback;
    if (!hasSkippedOnboarding(user.uid)) return ROUTES.onboarding;
  }
  return fallback;
}

// The helpers below only talk to Firebase. Loading the profile is a separate
// step (routeAfterSignIn / AuthProvider): once Firebase has signed someone in
// they *are* signed in, so a profile hiccup must not be reported as a failed
// sign-in (retrying would then say "account already exists").

export async function signInUser(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signUpUser(
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return credential.user;
}

export async function resetUserPassword(email: string): Promise<void> {
  // Use the domain the person is actually on, so a missing or wrong
  // NEXT_PUBLIC_APP_URL on a deploy can't put a localhost link in the email.
  // Firebase only accepts domains listed under Authentication > Settings >
  // Authorized domains. Returning to /login works with Firebase's default hosted
  // reset page; if the template's action URL is customised to /reset-password,
  // that page receives the oobCode itself and this value isn't used for it.
  const actionCodeSettings = {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  };
  await sendPasswordResetEmail(auth, email, actionCodeSettings);
}

export async function signInWithGoogle(): Promise<User> {
  // Default scopes only (name, email, photo): we ask Google who they are, never for access to their data.
  const provider = new GoogleAuthProvider();
  // Always let them pick the account, instead of silently reusing whichever Google session the browser has.
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

/** Google One Tap hands us a Google ID token; Firebase turns it into the same account and session as the pop-up. */
export async function signInWithGoogleCredential(googleIdToken: string): Promise<User> {
  const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken));
  return credential.user;
}

/** Not offered yet (APPLE_SIGN_IN_ENABLED in social-auth-buttons.tsx); kept so enabling it is a one-line change. */
export async function signInWithApple(): Promise<User> {
  const provider = new OAuthProvider("apple.com");
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
  // If Google's One Tap script is on the page, stop it offering to sign the same person straight back in.
  if (typeof window !== "undefined") window.google?.accounts.id.disableAutoSelect();
}

// Right after sign-in two callers want the profile at the same moment (AuthProvider, and the form deciding
// where to go next): they share one request. Nothing is kept once it answers, so every later call is fresh.
const profileRequests = new Map<string, Promise<unknown>>();

export async function fetchUserProfile(user: User): Promise<unknown> {
  if (USE_MOCKS) return mockProfile(user);
  const running = profileRequests.get(user.uid);
  if (running) return running;
  const request = apiFetch<unknown>(user, "/users/me").finally(() => {
    if (profileRequests.get(user.uid) === request) profileRequests.delete(user.uid);
  });
  profileRequests.set(user.uid, request);
  return request;
}

/** Mock of the API's nearby-Hood search: open Hoods close to a point, nearest first. */
function mockNearbyHoods(point: { lat: number; lng: number }): NearbyHood[] {
  return MOCK_NEARBY_HOODS.map((h) => ({ id: h.id, name: h.name, city: h.city, distanceMeters: Math.round(distanceMeters(point, h)) }))
    .filter((h) => h.distanceMeters <= MOCK_NEARBY_LIMIT_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3);
}

export async function verifyLocationApi(
  user: User,
  coords: { lat: number; lng: number },
): Promise<VerifyLocationResult> {
  if (USE_MOCKS) {
    const lekki = MOCK_NEARBY_HOODS[0]!;
    const toLekki = Math.round(distanceMeters(coords, lekki));
    if (toLekki <= MOCK_HOOD_RADIUS_M) {
      updateMockProfile(user, { verificationStatus: "verified", neighborhoodId: MOCK_NEIGHBORHOOD._id, location: coords, lastKnownLocation: coords, requestedHood: null });
      return { verificationStatus: "verified", neighborhoodId: MOCK_NEIGHBORHOOD._id, distanceMeters: toLekki };
    }
    const current = mockProfile(user);
    updateMockProfile(user, { lastKnownLocation: coords });
    return {
      verificationStatus: current.verificationStatus === "verified" ? "verified" : "unverified",
      reason: "outside_coverage",
      nearbyHoods: mockNearbyHoods(coords),
    };
  }
  return apiFetch(user, "/users/me/verify-location", {
    method: "POST",
    json: { lng: coords.lng, lat: coords.lat },
  });
}

/**
 * Ask to join a Hood near (but not covering) your address. Staff approve it
 * from the verification queue; until then you're "pending_review". Returns
 * the updated profile. Contract §16.
 */
export async function requestHoodApi(user: User, hoodId: string): Promise<unknown> {
  if (isLive("users.hoodRequest")) {
    return apiFetch<unknown>(user, "/users/me/hood-request", { method: "POST", json: { hoodId } });
  }
  // Same rules the API enforces: only an offered Hood, never once verified.
  const current = mockProfile(user) as { verificationStatus?: string; lastKnownLocation?: { lat: number; lng: number } };
  if (current.verificationStatus === "verified") {
    throw new ApiError("You're already a verified neighbour.", 409, "client");
  }
  const hood = current.lastKnownLocation ? mockNearbyHoods(current.lastKnownLocation).find((h) => h.id === hoodId) : undefined;
  if (!hood) throw new ApiError("That neighbourhood isn't near your address.", 400, "client");
  return updateMockProfile(user, {
    verificationStatus: "pending_review",
    requestedHood: { id: hood.id, name: hood.name, requestedAt: new Date().toISOString() },
  });
}

/** Withdraw a pending join request. Returns the updated profile. */
export async function cancelHoodRequestApi(user: User): Promise<unknown> {
  if (isLive("users.hoodRequest")) {
    return apiFetch<unknown>(user, "/users/me/hood-request", { method: "DELETE" });
  }
  const current = mockProfile(user) as { verificationStatus?: string };
  if (current.verificationStatus !== "pending_review") {
    throw new ApiError(FRIENDLY_MESSAGES.client, 409, "client");
  }
  return updateMockProfile(user, { verificationStatus: "unverified", requestedHood: null });
}

export async function updateProfileApi(
  user: User,
  payload: { displayName?: string },
): Promise<unknown> {
  if (USE_MOCKS) return updateMockProfile(user, payload);
  return apiFetch<unknown>(user, "/users/me", { method: "PATCH", json: payload });
}

/**
 * "Sign out everywhere": the API revokes every refresh token, which ends the
 * account's sessions on all devices (ID tokens and session cookies alike).
 * Needs a still-valid ID token, so call it before signing out here.
 */
export async function revokeAllSessionsApi(user: User): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch<void>(user, "/auth/logout-everywhere", { method: "POST" });
}

export interface NeighborhoodSummary {
  _id: string;
  name: string;
  description?: string;
  city: string;
  country: string;
  radiusMeters?: number;
  isActive?: boolean;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
}

export async function fetchNeighborhood(
  user: User,
  neighborhoodId: string,
): Promise<NeighborhoodSummary | null> {
  if (USE_MOCKS) return neighborhoodId === MOCK_NEIGHBORHOOD._id ? MOCK_NEIGHBORHOOD : null;
  try {
    return await apiFetch<NeighborhoodSummary>(user, `/neighborhoods/${neighborhoodId}`);
  } catch (err) {
    if (err instanceof ApiError && err.kind === "not_found") return null;
    throw err;
  }
}

export async function completeOnboardingApi(
  user: User,
  payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  },
): Promise<unknown> {
  if (USE_MOCKS) return updateMockProfile(user, { ...payload, isOnboarded: true });
  return apiFetch<unknown>(user, "/users/me/onboarding", { method: "PATCH", json: payload });
}
