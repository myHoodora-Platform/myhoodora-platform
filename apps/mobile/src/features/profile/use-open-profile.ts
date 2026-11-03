import { useCallback } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";

/** Where tapping someone goes: your own profile for you, theirs for anyone else (`/u/<uid>`). Nothing without a uid (a departed author). */
export function useOpenProfile() {
  const user = useSignedInUser();
  const router = useRouter();
  return useCallback(
    (uid?: string | null) => {
      if (!uid) return;
      router.push(uid === user.uid ? "/more" : `/u/${uid}`);
    },
    [router, user.uid],
  );
}
