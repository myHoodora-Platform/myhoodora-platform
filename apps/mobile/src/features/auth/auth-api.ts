import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword } from "@firebase/auth";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { config } from "@/core/config/env";
import { firebaseAuth } from "@/core/firebase/auth";

/**
 * Email and password go to Firebase, never to our API. The session (and the profile load that
 * follows) is picked up by AuthProvider from Firebase's auth state.
 */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
}

export async function signUp(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
}

/** The reset link opens Firebase's page, then returns to the web's login (Firebase's authorised domains). */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email.trim(), { url: `${config().webUrl}/login`, handleCodeInApp: false });
}

/** This build has no Google client ID for this platform (see .env.example): Google sign-in is off. */
export class GoogleSignInUnavailable extends Error {
  constructor() {
    super("Google sign-in isn't set up in this version of the app yet. Use your email and password for now.");
  }
}

let googleConfigured = false;

/**
 * Google's own sheet signs the person in and returns a Google ID token for the web client of the
 * Firebase Google provider; Firebase turns it into the same account the web uses (same UID for the
 * same email, docs/authentication.md). Returns false when the person closes the sheet.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const { webClientId, iosClientId } = config().google;
  if (!webClientId || (Platform.OS === "ios" && !iosClientId)) throw new GoogleSignInUnavailable();
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId, iosClientId });
    googleConfigured = true;
  }
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) return false;
    const idToken = result.data.idToken;
    if (!idToken) throw new Error("Google didn't return a sign-in token.");
    await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
    return true;
  } catch (err) {
    if (isErrorWithCode(err) && (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)) return false;
    throw err;
  }
}
