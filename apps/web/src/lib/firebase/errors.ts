import { AUTH_ERROR_MAP } from "@myhoodora/api-contract/auth-errors";
import { ApiError } from "@/lib/api/client";

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


export function getAuthErrorMessage(error: unknown): {
  code?: string;
  message: string;
  silent?: boolean;
} {
  // Log real error in dev environment
  if (process.env.NODE_ENV === "development") {
    console.error("[FirebaseAuthErrorDebug]:", error);
  }

  // Signed in with Firebase, but our own session couldn't be set up: already a readable message.
  if (error instanceof ApiError) return { message: error.message };

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
