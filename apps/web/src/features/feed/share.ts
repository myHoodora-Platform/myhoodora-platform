import { toast } from "sonner";
import { withInviteRef } from "@myhoodora/api-contract/invites";
import { myInviteCode } from "@/features/invites/invite-ref";

/** Every link a neighbour shares carries their invite code, so a share is an invite (plan WP-E). */
export function absoluteUrl(path: string): string {
  return `${window.location.origin}${withInviteRef(path, myInviteCode())}`;
}

export async function copyLink(path: string) {
  try {
    await navigator.clipboard.writeText(absoluteUrl(path));
    toast.success("Link copied.");
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

/** Native share sheet (WhatsApp etc. on mobile), falling back to copying the link. */
export async function shareLink(path: string, text: string) {
  const url = absoluteUrl(path);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "myHoodora", text: text.slice(0, 120), url });
    } catch (err) {
      // AbortError is the user cancelling the native share sheet — not an error.
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Couldn't share this.");
      }
    }
    return;
  }
  await copyLink(path);
}
