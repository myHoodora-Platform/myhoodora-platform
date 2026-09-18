"use client";

import { useAuth } from "@/context/AuthContext";
import { useRequireOnboarded } from "@/hooks/use-require-onboarded";
import { FeaturePreviewHeader } from "@/components/dashboard/feature-preview-header";
import { Button } from "@myhoodora/ui/button";
import { Badge } from "@myhoodora/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";

type EventCategory = "Cleanup" | "Social" | "Meeting" | "Kids";

const CATEGORY_STYLES: Record<EventCategory, string> = {
  Cleanup: "bg-emerald-100 text-emerald-700",
  Social: "bg-violet-100 text-violet-700",
  Meeting: "bg-slate-100 text-slate-700",
  Kids: "bg-amber-100 text-amber-700",
};

interface CommunityEvent {
  day: string;
  date: string;
  month: string;
  title: string;
  time: string;
  location: string;
  category: EventCategory;
  attendeeCount: number;
}

const mockEvents: CommunityEvent[] = [
  {
    day: "Sat",
    date: "20",
    month: "Sep",
    title: "Neighborhood Park Cleanup",
    time: "9:00 AM – 11:00 AM",
    location: "Maple Park, Main Entrance",
    category: "Cleanup",
    attendeeCount: 24,
  },
  {
    day: "Sun",
    date: "21",
    month: "Sep",
    title: "Estate Social Mixer & Potluck",
    time: "4:00 PM – 7:00 PM",
    location: "Community Hall",
    category: "Social",
    attendeeCount: 41,
  },
  {
    day: "Tue",
    date: "23",
    month: "Sep",
    title: "Resident Association Monthly Meeting",
    time: "6:30 PM – 8:00 PM",
    location: "Estate Office, Conference Room",
    category: "Meeting",
    attendeeCount: 12,
  },
  {
    day: "Sat",
    date: "27",
    month: "Sep",
    title: "Kids' Weekend Playdate",
    time: "10:00 AM – 12:00 PM",
    location: "Oakwood Playground",
    category: "Kids",
    attendeeCount: 18,
  },
];

export default function CommunityEventsPage() {
  useRequireOnboarded();
  const { runGatedAction } = useAuth();

  const handleRsvp = () => {
    runGatedAction(() => {
      // No backend for this feature yet — demo action only.
    });
  };

  return (
    <div className="space-y-6">
      <FeaturePreviewHeader
        icon={Calendar}
        title="Community Events"
        description="Upcoming meetups, cleanups, and get-togethers happening around your neighborhood."
      />

      <div className="space-y-4">
        {mockEvents.map((event, idx) => (
          <article
            key={idx}
            className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="flex h-fit w-16 shrink-0 flex-col items-center rounded-xl border border-slate-100 bg-slate-50 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {event.month}
              </span>
              <span className="text-xl font-black text-slate-800">{event.date}</span>
              <span className="text-[10px] font-bold text-muted-foreground">
                {event.day}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-black text-slate-800">{event.title}</h3>
                <Badge className={CATEGORY_STYLES[event.category]}>
                  {event.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{event.time}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {event.location}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Users className="size-3.5" />
                  {event.attendeeCount} attending
                </span>
                <Button size="sm" variant="outline" onClick={handleRsvp}>
                  RSVP
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
