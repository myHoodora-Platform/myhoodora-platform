"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { trackFunnel } from "@/lib/api/funnel";
import { myInviteCode } from "@/features/invites/invite-ref";
import { androidOpenHref, bannerClosedRecently, closeBanner } from "./app-prompt-rules";
import { useAppPrompts } from "./use-app-prompts";

/** Pages with their own "open in the app" (shared posts, invite links) or that shouldn't carry one. */
const SKIP = [/^\/shared\//, /^\/i\//, /^\/admin/, /^\/invite\/poster/, /^\/oauth/];

/**
 * The slim "Open in the app" bar on phones (plan WP-H; how Nextdoor, Reddit and YouTube do it): never
 * covers the page, opens the same page in the app (the store when it isn't installed), and stays away
 * two weeks once closed. Android always; iPhone once the App Store link is set.
 */
export function AppBanner() {
  const pathname = usePathname();
  const { device, prompts, iosStoreUrl, ready } = useAppPrompts();
  const [closed, setClosed] = useState(true);
  useEffect(() => setClosed(bannerClosedRecently()), []);
  const show = ready && prompts.banner && !closed && !SKIP.some((r) => r.test(pathname)) && (device === "android" || (device === "ios" && Boolean(iosStoreUrl)));
  useEffect(() => {
    if (show) trackFunnel("banner_shown");
  }, [show]);
  if (!show) return null;

  const href = device === "android" ? androidOpenHref(pathname + window.location.search, myInviteCode()) : iosStoreUrl!;
  return (
    <div role="region" aria-label="Get the myHoodora app" className="flex items-center gap-3 border-b border-border bg-card px-3 py-2 print:hidden">
      <button
        type="button"
        onClick={() => {
          closeBanner();
          setClosed(true);
          trackFunnel("banner_dismiss");
        }}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- the small app icon */}
      <img src="/logo/app-icon.png" alt="" className="size-10 rounded-xl ring-1 ring-border" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold">myHoodora</p>
        <p className="truncate text-xs text-muted-foreground">Safety alerts the moment they happen</p>
      </div>
      <a href={href} onClick={() => trackFunnel("banner_open")} className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
        {device === "android" ? "Open" : "Get"}
      </a>
    </div>
  );
}
