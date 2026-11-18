"use client";

import { useEffect, useState } from "react";
import { DEFAULT_APP_PROMPTS, type AppPrompts } from "@myhoodora/api-contract/app-config";
import { getAppConfig } from "@/lib/api/app-config";
import { deviceOf, isStandalone, type Device } from "./app-prompt-rules";

/**
 * Whether this visitor may be invited to the app, and how: Android always (the store is live); iPhone
 * once admins have put the App Store link in (Settings → Platform → App updates). Never in the app's
 * own web view, a home-screen install, or on a computer.
 */
export function useAppPrompts(): { device: Device; prompts: AppPrompts; iosStoreUrl: string | null; ready: boolean } {
  const [state, setState] = useState<{ device: Device; prompts: AppPrompts; iosStoreUrl: string | null; ready: boolean }>({ device: "other", prompts: DEFAULT_APP_PROMPTS, iosStoreUrl: null, ready: false });
  useEffect(() => {
    let live = true;
    const device = isStandalone() ? "other" : deviceOf(navigator.userAgent);
    if (device === "other") return;
    void getAppConfig().then((c) => {
      if (!live) return;
      setState({ device, prompts: c?.appPrompts ?? DEFAULT_APP_PROMPTS, iosStoreUrl: c?.updates?.ios.storeUrl ?? null, ready: true });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
