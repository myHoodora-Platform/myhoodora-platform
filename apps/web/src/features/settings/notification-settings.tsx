"use client";

import { Skeleton } from "@myhoodora/ui/skeleton";
import { ErrorState, PreviewNotice } from "@/components/shared/states";
import type { NotificationCategory, Preferences } from "@/lib/api/settings";
import { Segmented, SettingsSection, Switch } from "./ui";
import { usePreferences } from "./use-preferences";

const CATEGORIES: { id: NotificationCategory; label: string; description: string }[] = [
  { id: "urgent_alerts", label: "Urgent alerts", description: "Break-ins, fires, flooding happening now" },
  { id: "alerts", label: "Other alerts", description: "Power, water, traffic and scam warnings" },
  { id: "comments", label: "Comments on your posts", description: "Replies from neighbours" },
  { id: "messages", label: "Messages", description: "New private messages" },
  { id: "events", label: "Events", description: "RSVPs to your events and new events nearby" },
  { id: "for_sale", label: "For Sale & Free", description: "Messages about your listings and new free items" },
  { id: "groups", label: "Groups", description: "Activity in groups you've joined" },
];

const DIGEST = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "off", label: "Off" },
] as const;

export function NotificationSettings() {
  const { prefs, error, change } = usePreferences();

  if (error) return <ErrorState title="Couldn't load your settings" message={error} onRetry={() => window.location.reload()} />;
  if (!prefs) return <Skeleton className="h-96 rounded-2xl" />;

  const setChannel = (id: NotificationCategory, channel: "push" | "email", value: boolean) =>
    void change({
      ...prefs,
      notifications: { ...prefs.notifications, [id]: { ...prefs.notifications[id], [channel]: value } },
    });

  return (
    <div className="space-y-4">
      <PreviewNotice endpoint="settings" />
      <SettingsSection title="Notifications" description="Choose what we notify you about. Changes save automatically.">
        <div className="hidden grid-cols-[1fr_64px_64px] px-5 pt-3 text-xs font-bold tracking-wide text-muted-foreground uppercase sm:grid">
          <span />
          <span className="text-center">Push</span>
          <span className="text-center">Email</span>
        </div>
        {CATEGORIES.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[1fr_64px_64px] sm:px-5">
            <div>
              <p className="text-[15px] font-semibold">{c.label}</p>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </div>
            <div className="flex items-center gap-4 sm:contents">
              <div className="flex flex-col items-center gap-1 sm:justify-self-center">
                <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">Push</span>
                <Switch
                  label={`${c.label} push notifications`}
                  checked={prefs.notifications[c.id].push}
                  onChange={(v) => setChannel(c.id, "push", v)}
                />
              </div>
              <div className="flex flex-col items-center gap-1 sm:justify-self-center">
                <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">Email</span>
                <Switch
                  label={`${c.label} emails`}
                  checked={prefs.notifications[c.id].email}
                  onChange={(v) => setChannel(c.id, "email", v)}
                />
              </div>
            </div>
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="Neighbourhood digest" description="One email with the most useful posts, instead of many.">
        <div className="px-4 py-4 sm:px-5">
          <Segmented
            label="Digest frequency"
            value={prefs.digest}
            options={DIGEST}
            onChange={(digest: Preferences["digest"]) => void change({ ...prefs, digest })}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
