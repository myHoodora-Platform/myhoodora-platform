import { APP_VERSION_PATTERN, compareVersions, type AppVersionRule } from "./platform-settings.schema";

/** How the app versions look after themselves (Admin → Settings → Platform → App updates). */
export interface AppUpdatesAuto {
  /** Raise Latest to the version live in the store, checked a few times a day. */
  fromStores: boolean;
  /** Days after Latest last rose before Minimum follows it (0: Minimum is only changed by hand). */
  requireAfterDays: number;
}
export const DEFAULT_APP_UPDATES_AUTO: AppUpdatesAuto = { fromStores: true, requireAfterDays: 30 };
export const MAX_REQUIRE_AFTER_DAYS = 365;

/** What a store showed at the last check. `version` null: not in that store (yet), or the check isn't set up. */
export interface StoreSighting {
  version: string | null;
  url: string | null;
}

export interface RuleChange {
  field: "latest" | "minimum" | "storeUrl";
  from: string;
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One platform's next versions. Latest rises to a newer store version; the store page is filled in once
 * known; Minimum follows Latest once `requireAfterDays` have passed since Latest rose, but never above the
 * version actually in the store (when the store can be checked), so a mistyped Latest can't lock everyone
 * out of an update that doesn't exist.
 */
export function advanceRule(rule: AppVersionRule, seen: StoreSighting | null, auto: AppUpdatesAuto, now: Date): { rule: AppVersionRule; changes: RuleChange[] } {
  const next = { ...rule };
  const changes: RuleChange[] = [];
  const set = (field: RuleChange["field"], to: string) => {
    changes.push({ field, from: next[field], to });
    next[field] = to;
  };
  const storeVersion = seen?.version && APP_VERSION_PATTERN.test(seen.version) ? seen.version : null;

  if (storeVersion && auto.fromStores && compareVersions(storeVersion, next.latest) > 0) {
    set("latest", storeVersion);
    next.latestSince = now;
  }
  if (!next.storeUrl && seen?.url?.startsWith("https://")) set("storeUrl", seen.url);

  const since = next.latestSince ? new Date(next.latestSince).getTime() : NaN;
  if (auto.requireAfterDays > 0 && Number.isFinite(since) && now.getTime() - since >= auto.requireAfterDays * DAY_MS) {
    // Never require more than the store has, when we know what the store has.
    const target = storeVersion && compareVersions(storeVersion, next.latest) < 0 ? storeVersion : next.latest;
    if (compareVersions(target, next.minimum) > 0) set("minimum", target);
  }
  return { rule: next, changes };
}
