import type { User } from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from "firebase/storage";
import { storage } from "@/lib/firebase/config";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const UPLOAD_TIMEOUT_MS = 6000;

/**
 * Uploads an image file to Firebase Storage under the current user's own
 * path and returns its public download URL. Requires Storage security rules
 * that allow an authenticated user to write to `posts/{uid}/...` — see
 * apps/api/README.md TODOs for the exact rules snippet. This is the swap
 * target if a backend-mediated upload flow is added later.
 *
 * Races against a fixed timeout: an unprovisioned/misconfigured Storage
 * bucket can leave the underlying SDK call pending indefinitely with no
 * rejection, which would otherwise hang the composer's upload spinner
 * forever with no feedback.
 */
export async function uploadImageFile(
  user: User,
  file: File,
  storageInstance: FirebaseStorage = storage,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be attached to a post.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be smaller than 8MB.");
  }

  const path = `posts/${user.uid}/${Date.now()}-${file.name}`;
  const fileRef = ref(storageInstance, path);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            "Upload timed out. Photo uploads aren't set up yet for this project — try pasting an image URL instead.",
          ),
        ),
      UPLOAD_TIMEOUT_MS,
    ),
  );

  await Promise.race([uploadBytes(fileRef, file), timeout]);
  return getDownloadURL(fileRef);
}

/** Validates a pasted image URL. Converges with uploadImageFile on the same string result. */
export function resolveImageUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error("Enter a valid image URL starting with http:// or https://");
  }
  return trimmed;
}
