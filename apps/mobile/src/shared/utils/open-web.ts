import * as WebBrowser from "expo-web-browser";
import { config } from "@/core/config/env";

/** Opens one of the website's pages (help, guidelines, terms) in the in-app browser. */
export function openWeb(path: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(`${config().webUrl}${path}`);
}
