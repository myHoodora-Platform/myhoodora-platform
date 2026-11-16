import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeUpdateStatus, type AppConfig, type AppVersionRule } from "@myhoodora/api-contract/app-config";
import { useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { accountKeys, getAppConfig } from "@/features/account/account-api";

/** A skipped "New version available" comes back after this long, or straight away for a newer version. */
export const SKIP_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = "updates.store.skipped.v1";

interface Skipped {
  version: string;
  at: string;
}

/** Whether the sheet for `latest` should show, given what was skipped and when. */
export function offerAgain(skipped: Skipped | null, latest: string, now: Date): boolean {
  if (!skipped || skipped.version !== latest) return true;
  const at = Date.parse(skipped.at);
  return !Number.isFinite(at) || now.getTime() - at >= SKIP_DAYS * DAY_MS;
}

function parse(raw: string | null): Skipped | null {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Skipped>) : null;
    return v && typeof v.version === "string" && typeof v.at === "string" ? { version: v.version, at: v.at } : null;
  } catch {
    return null;
  }
}

export interface StoreUpdate {
  /** "required": nothing else until they update; "available": offer it; "none": say nothing. */
  status: "required" | "available" | "none";
  rule: AppVersionRule | null;
  /** The version this phone has (the store build's, not an over-the-air update's). */
  installed: string | null;
  skip: () => void;
}

/**
 * Compares the installed store version with the versions admins set (GET /app-config → updates). Read at
 * launch and whenever the app config refreshes; an unreachable API says nothing rather than blocking.
 */
export function useStoreUpdate(): StoreUpdate {
  const installed = Application.nativeApplicationVersion;
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : null;
  const config = useQuery<AppConfig>({ queryKey: accountKeys.appConfig, queryFn: getAppConfig, staleTime: 60 * 60 * 1000, enabled: platform !== null });
  const rule = (platform && config.data?.updates?.[platform]) || null;
  const status = storeUpdateStatus(installed, rule);

  const [skipped, setSkipped] = useState<{ loaded: boolean; value: Skipped | null }>({ loaded: false, value: null });
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((raw) => !cancelled && setSkipped({ loaded: true, value: parse(raw) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const skip = useCallback(() => {
    if (!rule) return;
    const value = { version: rule.latest, at: new Date().toISOString() };
    setSkipped({ loaded: true, value });
    void AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => undefined);
  }, [rule]);

  const shown = status === "available" && !(skipped.loaded && rule && offerAgain(skipped.value, rule.latest, new Date())) ? "none" : status;
  return { status: shown, rule, installed, skip };
}
