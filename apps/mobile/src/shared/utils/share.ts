import { Share } from "react-native";
import { config } from "@/core/config/env";

/**
 * The phone's own share sheet (WhatsApp, SMS, copy) with the web's link for it: the web and the app
 * use the same paths, so the link opens for any neighbour, signed in on either.
 */
export async function shareLink(path: string, message: string): Promise<void> {
  const url = `${config().webUrl}${path}`;
  // iOS shows `url` as a link preview; Android only shares `message`, so the link goes in it too.
  await Share.share({ message: `${message}\n${url}`, url }).catch(() => undefined);
}
