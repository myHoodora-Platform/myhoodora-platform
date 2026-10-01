"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Star } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { getRsvp, setRsvp } from "@/lib/api/events";
import { errorMessage } from "@/lib/api/client";
import { downloadIcs, type CalendarEvent } from "@/lib/calendar";
import type { EventRsvpSummary, RsvpStatus } from "@/lib/api/types";
import { eventPhase } from "./event-time";

interface RsvpButtonsProps {
  postId: string;
  compact?: boolean;
  /** Closes RSVPs once the event is over (the API refuses them too). */
  eventDate?: string;
  /** Shown as "Add to calendar" once you're going. */
  calendar?: CalendarEvent | null;
}

export function RsvpButtons({ postId, compact, eventDate, calendar }: RsvpButtonsProps) {
  const { user, runGatedAction } = useAuth();
  const [rsvp, setState] = useState<EventRsvpSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void getRsvp(user, postId).then(setState).catch(() => undefined);
  }, [user, postId]);

  const ended = rsvp?.ended ?? eventPhase(eventDate) === "ended";

  const choose = (status: RsvpStatus) => {
    if (!user || !rsvp || ended) return;
    runGatedAction(async () => {
      const next = rsvp.myStatus === status ? null : status;
      setBusy(true);
      try {
        setState(await setRsvp(user, postId, next));
        if (next === "going") toast.success("You're going! We'll remind you before it starts.");
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't update your RSVP."));
      } finally {
        setBusy(false);
      }
    });
  };

  if (ended) {
    const went = rsvp?.goingCount ?? 0;
    return (
      <p className="inline-flex h-10 items-center rounded-full bg-muted px-4 text-sm font-semibold text-muted-foreground">
        This event has ended{went > 0 ? ` · ${went} went` : ""}
        {rsvp?.myStatus === "going" && " · including you"}
      </p>
    );
  }

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
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
        {!compact && count !== undefined && count > 0 && <span className="opacity-75">· {count}</span>}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn("going", "Going", Check, rsvp?.goingCount)}
      {btn("interested", "Interested", Star, rsvp?.interestedCount)}
      {calendar && rsvp?.myStatus === "going" && (
        <button
          type="button"
          onClick={() => downloadIcs(calendar)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          <CalendarPlus className="size-4" aria-hidden />
          Add to calendar
        </button>
      )}
    </div>
  );
}
