"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Camera, Zap } from "lucide-react";
import { trackFunnel } from "@/lib/api/funnel";
import { myInviteCode } from "@/features/invites/invite-ref";
import { androidOpenHref, closeSheet, countVisit, sheetClosedRecently } from "./app-prompt-rules";
import { useAppPrompts } from "./use-app-prompts";

const WHY = [
  { Icon: BellRing, text: "Safety alerts the moment they happen, even with the app closed" },
  { Icon: Zap, text: "Faster, and kinder to your data" },
  { Icon: Camera, text: "Share photos straight from your camera" },
];

/**
 * "myHoodora is better in the app" (plan WP-H): once, at a good moment (a second visit, signed in on a
 * phone), never on the first page someone lands on, at most every N days after it's closed (admins
 * set N). "Continue in browser" is always right there.
 */
export function BetterInAppSheet() {
  const pathname = usePathname();
  const { device, prompts, iosStoreUrl, ready } = useAppPrompts();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    const visits = countVisit();
    const reachable = device === "android" || (device === "ios" && Boolean(iosStoreUrl));
    if (!prompts.sheet || !reachable || visits < 2 || sheetClosedRecently(prompts.sheetEveryDays)) return;
    // Not straight away: after they've had a moment with the page.
    const id = setTimeout(() => {
      setOpen(true);
      trackFunnel("sheet_shown");
    }, 4000);
    return () => clearTimeout(id);
  }, [ready, device, iosStoreUrl, prompts]);

  if (!open) return null;
  const close = () => {
    closeSheet();
    setOpen(false);
    trackFunnel("sheet_dismiss");
  };
  const href = device === "android" ? androidOpenHref(pathname, myInviteCode()) : iosStoreUrl!;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 print:hidden" role="dialog" aria-modal="true" aria-labelledby="better-in-app" onClick={close}>
      <div className="w-full max-w-md animate-fade-in rounded-t-3xl bg-card px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-muted" aria-hidden />
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the small app icon */}
          <img src="/logo/app-icon.png" alt="" className="size-14 rounded-2xl ring-1 ring-border" />
          <h2 id="better-in-app" className="text-xl font-extrabold">
            myHoodora is better in the app
          </h2>
        </div>
        <ul className="mt-4 space-y-2.5">
          {WHY.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden /> {text}
            </li>
          ))}
        </ul>
        <a href={href} onClick={() => trackFunnel("sheet_open")} className="mt-5 block w-full rounded-xl bg-primary py-3 text-center text-base font-bold text-primary-foreground">
          {device === "android" ? "Open the app" : "Get the app"}
        </a>
        <button type="button" onClick={close} className="mt-2 block w-full rounded-xl py-3 text-center text-sm font-semibold text-muted-foreground hover:bg-muted">
          Continue in browser
        </button>
      </div>
    </div>
  );
}
