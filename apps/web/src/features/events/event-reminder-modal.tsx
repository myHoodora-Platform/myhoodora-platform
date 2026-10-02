"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, CalendarDays, CalendarPlus, MapPin } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { setRsvp } from "@/lib/api/events";
import { getPost } from "@/lib/api/posts";
import { downloadIcs } from "@/lib/calendar";
import { formatEventDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { AppNotification, Post } from "@/lib/api/types";
import { calendarFor, eventPhase, eventTitle } from "./event-time";

/** The final reminder to show (unread, newest first), if any. Shown once: every way out marks it read. */
export function pickFinalReminder(items: AppNotification[]): AppNotification | null {
  return items.find((n) => !n.read && n.kind === "event_reminder_final" && !!n.subjectId) ?? null;
}

/** "in 2 h 15 min" / "in 40 min" / "now". */
export function startsIn(startIso: string, now = new Date()): string {
  const mins = Math.round((new Date(startIso).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "now";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `in ${h} h${m ? ` ${m} min` : ""}` : `in ${m} min`;
}

/**
 * The last reminder before an event you're going to (contract §23): pops up
 * once, when the app is open or as soon as it's opened, with what you need
 * to show up (time, place, add to calendar) and an easy "can't go".
 */
export function EventReminderModal({ items, markRead }: { items: AppNotification[]; markRead: (id: string) => Promise<void> }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const reminder = pickFinalReminder(items);
  const [post, setPost] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    if (!user || !profile?.neighborhoodId || !reminder?.subjectId) return;
    void getPost(user, profile.neighborhoodId, reminder.subjectId)
      .then((p) => {
        if (cancelled) return;
        // Gone, or already over by the time they opened the app: nothing to remind about.
        if (!p || eventPhase(p.meta.eventDate) === "ended") return void markRead(reminder._id);
        setPost(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, profile?.neighborhoodId, reminder?._id, reminder?.subjectId, markRead]);

  if (!reminder || !post?.meta.eventDate) return null;
  const { title } = eventTitle(post);
  const live = eventPhase(post.meta.eventDate) === "live";
  const close = () => void markRead(reminder._id);

  const cantGo = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await setRsvp(user, post._id, null);
      toast.success("You're no longer going.");
      close();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your RSVP."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      {/* Closes only on a deliberate choice (a button, Esc, ✕): a stray click or focus change outside must not
          dismiss it, because dismissing marks the reminder read and it won't come back. */}
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BellRing className="size-5" aria-hidden />
          </span>
          <DialogTitle>{live ? "Happening now" : `Starting ${startsIn(post.meta.eventDate)}`}</DialogTitle>
          <DialogDescription className="text-base font-semibold text-foreground">{title.replace(/[.!?]+$/, "")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-xl bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            {formatEventDate(post.meta.eventDate)}
          </p>
          {post.meta.eventLocation && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {post.meta.eventLocation}
            </p>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            onClick={() => {
              close();
              router.push(ROUTES.post(post._id));
            }}
          >
            View event
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const cal = calendarFor(post);
              if (cal) downloadIcs(cal);
              close();
            }}
          >
            <CalendarPlus className="size-4" aria-hidden />
            Add to calendar
          </Button>
          <Button variant="ghost" onClick={() => void cantGo()} loading={busy}>
            Can&apos;t go anymore
          </Button>
          <Button variant="ghost" onClick={close}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
