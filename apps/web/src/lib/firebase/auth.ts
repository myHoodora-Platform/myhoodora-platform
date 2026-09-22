import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./config";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/**
 * Syncs the Firebase user profile to the NestJS backend DB.
 * Automatically called on successful sign-in/registration.
 */
export async function syncUserProfile(user: User): Promise<unknown> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to sync user profile with backend.");
  }

  return response.json();
}

export async function signInUser(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await syncUserProfile(credential.user);
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
  await syncUserProfile(credential.user);
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
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await syncUserProfile(credential.user);
  return credential.user;
}

export async function signInWithApple(): Promise<User> {
  const provider = new OAuthProvider("apple.com");
  const credential = await signInWithPopup(auth, provider);
  await syncUserProfile(credential.user);
  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(user: User): Promise<unknown> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch user profile.");
  }

  return response.json();
}

export async function verifyLocationApi(
  user: User,
  coords: { lat: number; lng: number },
): Promise<{
  verificationStatus: string;
  neighborhoodId?: string;
  distanceMeters?: number;
  reason?: string;
}> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/users/me/verify-location`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lng: coords.lng, lat: coords.lat }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to verify location on server.");
  }

  return response.json();
}

export async function updateProfileApi(
  user: User,
  payload: { displayName?: string; neighborhoodId?: string },
): Promise<unknown> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to update profile on server.");
  }

  return response.json();
}

// Revokes the user's Firebase refresh tokens server-side. Must be called
// with a still-valid bearer token, before signOut() discards it.
export async function revokeBackendSession(user: User): Promise<void> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to revoke session on server: ${response.status}`);
  }
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

export interface CreateNeighborhoodPayload {
  name: string;
  city: string;
  country: string;
  radiusMeters: number;
  description?: string;
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
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/neighborhoods/${neighborhoodId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch neighborhood: ${response.status}`);
  }

  return response.json();
}

export async function fetchNeighborhoods(
  user: User,
): Promise<NeighborhoodSummary[]> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/neighborhoods`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch neighborhoods: ${response.status}`);
  }

  return response.json();
}

export async function createNeighborhood(
  user: User,
  payload: CreateNeighborhoodPayload,
): Promise<NeighborhoodSummary> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/neighborhoods`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to create neighborhood.");
  }

  return response.json();
}

export async function deleteNeighborhood(
  user: User,
  neighborhoodId: string,
): Promise<void> {
  const token = await user.getIdToken();
  const response = await fetch(
    `${API_BASE_URL}/neighborhoods/${neighborhoodId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete neighborhood: ${response.status}`);
  }
}

export async function fetchNearbyNeighborhoods(
  user: User,
  coords: { lng: number; lat: number },
  maxDistanceMeters?: number,
): Promise<NeighborhoodSummary[]> {
  const token = await user.getIdToken();
  const params = new URLSearchParams({
    lng: String(coords.lng),
    lat: String(coords.lat),
  });
  if (maxDistanceMeters) params.set("maxDistance", String(maxDistanceMeters));

  const response = await fetch(
    `${API_BASE_URL}/neighborhoods/nearby?${params.toString()}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch nearby neighborhoods: ${response.status}`);
  }

  return response.json();
}

export async function completeOnboardingApi(
  user: User,
  payload: {
    displayName?: string;
    location?: { lat?: number; lng?: number; address?: string };
  },
): Promise<unknown> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/users/me/onboarding`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to complete onboarding on server.");
  }

  return response.json();
}
