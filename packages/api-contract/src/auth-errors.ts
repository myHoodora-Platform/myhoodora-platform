/**
 * What a Firebase Authentication error code means to a person, in the wording both apps use.
 * Codes not listed get a generic message; the pop-up cancellations are silent ("").
 */
export const AUTH_ERROR_MAP: Record<string, string> = {
  // Silent cancellation errors
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",

  // Authentication errors
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password":
    "Password is too weak. Please use at least 8 characters.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed":
    "Network error. Check your connection and try again.",
  "auth/user-not-found": "We couldn't find an account with those details.",
  "auth/user-disabled": "We couldn't find an account with those details.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Please enter your password.",
  "auth/popup-blocked":
    "Your browser blocked the sign-in window. Allow pop-ups and try again.",
  "auth/account-exists-with-different-credential":
    "An account with this email already exists. Try logging in another way.",
  "auth/requires-recent-login":
    "For your security, please log in again and retry.",
  "auth/unauthorized-continue-uri":
    "We couldn't send the reset email from this site yet. Please contact the team.",
  "auth/expired-action-code":
    "This link has expired. Please request a new one.",
  "auth/invalid-action-code":
    "This link is invalid or has already been used. Please request a new one.",
};

/** The message for a thrown Firebase error (anything with a `code`), or null when it isn't one. */
export function authErrorMessage(err: unknown): string | null {
  const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : undefined;
  if (typeof code !== "string") return null;
  return AUTH_ERROR_MAP[code] ?? "Something went wrong. Please try again.";
}
