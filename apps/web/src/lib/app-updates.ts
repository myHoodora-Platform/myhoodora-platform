import { APP_VERSION_PATTERN, compareVersions, type AppPlatform } from "@myhoodora/api-contract/app-config";

/** One platform's store versions as admins edit them; `storeUrl` empty while the app isn't in that store. */
export interface AppVersionRuleDraft {
  latest: string;
  minimum: string;
  storeUrl: string;
}
export type AppUpdatesDraft = Record<AppPlatform, AppVersionRuleDraft>;

/** The API's defaults (apps/api platform-settings.schema.ts), for settings saved before this one existed. */
export const DEFAULT_APP_UPDATES: AppUpdatesDraft = {
  android: { latest: "1.0.0", minimum: "1.0.0", storeUrl: "https://play.google.com/store/apps/details?id=com.myhoodora.app" },
  ios: { latest: "1.0.0", minimum: "1.0.0", storeUrl: "" },
};

/** What's wrong with one platform's versions, in words for the form; null when it can be saved. */
export function appVersionRuleProblem(rule: AppVersionRuleDraft): string | null {
  if (!APP_VERSION_PATTERN.test(rule.latest) || !APP_VERSION_PATTERN.test(rule.minimum)) return "Versions look like 1.2.0.";
  if (compareVersions(rule.minimum, rule.latest) > 0) return "The minimum can't be newer than the latest.";
  if (rule.storeUrl && !/^https:\/\/\S+$/.test(rule.storeUrl)) return "The store page must start with https://";
  return null;
}
