import { withInviteRef } from "@myhoodora/api-contract/invites";
import { Share } from "react-native";
import { config } from "@/core/config/env";
import { myInviteCode } from "@/core/invites/invite-ref";

/**
 * The phone's own share sheet (WhatsApp, SMS, copy) with the web's link for it: the web and the app
 * use the same paths, so the link opens for any neighbour, signed in on either. Resolves true unless
 * they closed the sheet without sharing (iOS says so; Android can't tell, so it's always true there).
 */
export async function shareLink(path: string, message: string): Promise<boolean> {
  // Every link a neighbour shares carries their invite code, so a share is an invite (plan WP-E).
  const url = `${config().webUrl}${withInviteRef(path, myInviteCode())}`;
  // iOS shows `url` as a link preview; Android only shares `message`, so the link goes in it too.
  const result = await Share.share({ message: `${message}\n${url}`, url }).catch(() => null);
  return !!result && result.action !== Share.dismissedAction;
}
