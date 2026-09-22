interface FirebaseErrorLike {
  code: string;
  message: string;
}

function isFirebaseError(err: unknown): err is FirebaseErrorLike {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

const AUTH_ERROR_MAP: Record<string, string> = {
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

export function getAuthErrorMessage(error: unknown): {
  code?: string;
  message: string;
  silent?: boolean;
} {
  // Log real error in dev environment
  if (process.env.NODE_ENV === "development") {
    console.error("[FirebaseAuthErrorDebug]:", error);
  }

  let code: string | undefined;

  if (isFirebaseError(error)) {
    code = error.code;
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      return { code, message: "", silent: true };
    }
    const message = AUTH_ERROR_MAP[code];
    if (message !== undefined) {
      return { code, message };
    }
  }

  // Generic fallback error
  return { code, message: "Something went wrong. Please try again." };
}
