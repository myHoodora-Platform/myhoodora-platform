"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PLAY_STORE_URL } from "./app-prompt-rules";

/** On a computer: scan to get the app (plan WP-H: a QR in the sidebar, not a pop-up). */
export function GetTheAppCard() {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toString(PLAY_STORE_URL, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then(setSvg);
  }, []);
  if (!svg) return null;
  return (
    <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted/50">
      <span className="size-16 shrink-0 rounded-lg bg-white p-1" role="img" aria-label="QR code for the Google Play page" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-sm leading-snug">
        <span className="block font-semibold">Get the app</span>
        <span className="block text-muted-foreground">Scan with your phone for alerts that reach you instantly.</span>
      </span>
    </a>
  );
}
