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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const actionCodeSettings = {
    url: `${appUrl}/reset-password`,
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
