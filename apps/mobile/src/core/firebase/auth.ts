import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "@firebase/auth";
import { config } from "@/core/config/env";
import { secureStorage } from "./secure-storage";

/**
 * The same Firebase project as the web (ADR-003). Sign-in happens here; the API only ever sees the
 * resulting ID token.
 */
let auth: Auth | undefined;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(config().firebase);
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(secureStorage) });
  } catch {
    // Fast refresh re-runs this module after auth was initialised.
    auth = getAuth(app);
  }
  return auth;
}
