/** Contract §10 Preferences. Deep-merged on PATCH; defaults mirror the web. */
export const NOTIFICATION_CATEGORIES = ["urgent_alerts", "alerts", "comments", "messages", "events", "for_sale", "groups"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface Preferences {
  notifications: Record<NotificationCategory, { push: boolean; email: boolean }>;
  digest: "daily" | "weekly" | "off";
  privacy: {
    profileVisibility: "neighbourhood" | "nearby";
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

/** Merge a partial update over current prefs, keeping only known keys. */
export function mergePreferences(current: Preferences | undefined, patch: Partial<Preferences>): Preferences {
  const base = current ?? DEFAULT_PREFERENCES;
  const notifications = { ...DEFAULT_PREFERENCES.notifications, ...base.notifications };
  for (const cat of NOTIFICATION_CATEGORIES) {
    const p = patch.notifications?.[cat];
    if (p) notifications[cat] = { push: p.push ?? notifications[cat].push, email: p.email ?? notifications[cat].email };
  }
  // Urgent safety alerts can't be fully silenced (push stays on).
  notifications.urgent_alerts = { ...notifications.urgent_alerts, push: true };
  return {
    notifications,
    digest: patch.digest ?? base.digest ?? DEFAULT_PREFERENCES.digest,
    privacy: { ...DEFAULT_PREFERENCES.privacy, ...base.privacy, ...(patch.privacy ?? {}) },
  };
}
