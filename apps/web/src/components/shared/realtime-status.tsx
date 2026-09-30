"use client";

import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useRealtimeStatus } from "@/lib/realtime/realtime-provider";

/** Only a sustained problem is worth showing; brief blips reconnect on their own. */
const SHOW_AFTER_MS = 3_000;

/** Invisible while live; a small chip when live updates are reconnecting or delayed. */
export function RealtimeStatusChip({ className }: { className?: string }) {
  const status = useRealtimeStatus();
  const troubled = status === "reconnecting" || status === "offline";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!troubled) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [troubled]);

  if (!visible) return null;
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground", className)}
    >
      {status === "offline" ? <WifiOff className="size-3.5" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {status === "offline" ? "Offline · updates may be delayed" : "Reconnecting…"}
    </span>
  );
}
