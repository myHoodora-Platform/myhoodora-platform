/** Settings shared by the web and the app (contract §10). The API keeps its own copy with the merge rules. */

export type NotificationCategory = "urgent_alerts" | "alerts" | "comments" | "messages" | "events" | "for_sale" | "groups";

export interface ChannelPrefs {
  push: boolean;
  email: boolean;
}

export interface Preferences {
  notifications: Record<NotificationCategory, ChannelPrefs>;
  /** Email summary of neighbourhood activity. */
  digest: "daily" | "weekly" | "off";
  privacy: {
    /** Who can see your full profile (bio, neighbour since, posts). */
    profileVisibility: "neighbourhood" | "nearby";
    /** Who can start a private conversation with you. */
    messaging: "neighbourhood" | "contacts" | "nobody";
    showNeighbourSince: boolean;
  };
}

export const DEFAULT_PREFERENCES: Preferences = {
  notifications: {
    urgent_alerts: { push: true, email: true },
    alerts: { push: true, email: false },
    comments: { push: true, email: false },
    messages: { push: true, email: true },
    events: { push: false, email: false },
    for_sale: { push: false, email: false },
    groups: { push: true, email: false },
  },
  digest: "daily",
  privacy: { profileVisibility: "neighbourhood", messaging: "neighbourhood", showNeighbourSince: true },
};

/** The web's wording for each category. Urgent alerts' push can't be turned off (the API keeps it on). */
export const NOTIFICATION_CATEGORIES: { id: NotificationCategory; label: string; description: string }[] = [
  { id: "urgent_alerts", label: "Urgent alerts", description: "Break-ins, fires, flooding happening now" },
  { id: "alerts", label: "Other alerts", description: "Power, water, traffic and scam warnings" },
  { id: "comments", label: "Comments on your posts", description: "Replies from neighbours" },
  { id: "messages", label: "Messages", description: "New private messages" },
  { id: "events", label: "Events", description: "RSVPs to your events and new events nearby" },
  { id: "for_sale", label: "For Sale & Free", description: "Messages about your listings and new free items" },
  { id: "groups", label: "Groups", description: "Activity in groups you've joined" },
];

/** Nextdoor's list, in the web's words (POST /users/me/deactivate). */
export const DEACTIVATION_REASONS = [
  { id: "moved", label: "I moved or am moving" },
  { id: "not_useful", label: "I didn't find it useful" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "too_many_notifications", label: "Too many notifications" },
  { id: "negative", label: "Too many negative posts" },
  { id: "few_neighbours", label: "Not enough neighbours on myHoodora" },
  { id: "duplicate", label: "I have another account" },
  { id: "other", label: "Something else" },
] as const;

export type DeactivationReason = (typeof DEACTIVATION_REASONS)[number]["id"];

/** The API's profile limits (PATCH /users/me). */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 160;
