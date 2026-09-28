"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Star } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { getRsvp, setRsvp } from "@/lib/api/events";
import { errorMessage } from "@/lib/api/client";
import type { EventRsvpSummary, RsvpStatus } from "@/lib/api/types";

export function RsvpButtons({ postId, compact }: { postId: string; compact?: boolean }) {
  const { user, runGatedAction } = useAuth();
  const [rsvp, setState] = useState<EventRsvpSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void getRsvp(user, postId).then(setState).catch(() => undefined);
  }, [user, postId]);

  const choose = (status: RsvpStatus) => {
    if (!user || !rsvp) return;
    runGatedAction(async () => {
      const next = rsvp.myStatus === status ? null : status;
      setBusy(true);
      try {
        setState(await setRsvp(user, postId, next));
        if (next === "going") toast.success("You're going!");
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't update your RSVP."));
      } finally {
        setBusy(false);
      }
    });
  };

  const btn = (status: RsvpStatus, label: string, Icon: typeof Check, count?: number) => {
    const active = rsvp?.myStatus === status;
    return (
      <button
        type="button"
        onClick={() => choose(status)}
        disabled={!rsvp || busy}
        aria-pressed={active}
        className={cn(
          "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors disabled:opacity-60 sm:flex-none",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
        {!compact && count !== undefined && count > 0 && <span className="opacity-75">· {count}</span>}
      </button>
    );
  };

  return (
    <div className="flex gap-2">
      {btn("going", "Going", Check, rsvp?.goingCount)}
      {btn("interested", "Interested", Star, rsvp?.interestedCount)}
    </div>
  );
}
