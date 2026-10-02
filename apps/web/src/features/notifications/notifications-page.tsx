"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BellOff } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { FilterChips } from "@/components/shared/filter-chips";
import { EmptyState, PageHeader, PreviewNotice } from "@/components/shared/states";
import { ROUTES } from "@/lib/routes";
import type { AppNotification } from "@/lib/api/types";
import { NotificationItem } from "./notification-item";
import { useNotifications } from "./use-notifications";

const TABS = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Alerts" },
  { id: "activity", label: "My activity" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function matches(n: AppNotification, tab: Tab): boolean {
  if (tab === "alerts") return n.type === "alert";
  if (tab === "activity") return n.type !== "alert";
  return true;
}

function groupByTime(items: AppNotification[]) {
  const dayMs = 86_400_000;
  const now = Date.now();
  const groups: { label: string; items: AppNotification[] }[] = [
    { label: "Today", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const n of items) {
    const age = now - new Date(n.createdAt).getTime();
    groups[age < dayMs ? 0 : age < 7 * dayMs ? 1 : 2]!.items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function NotificationsPage() {
  const { items, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const raw = useSearchParams().get("tab");
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "all";
  const groups = useMemo(() => groupByTime(items.filter((n) => matches(n, tab))), [items, tab]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              Mark all as read
            </Button>
          )
        }
      />
      <PreviewNotice endpoint="notifications" />
      <FilterChips
        label="Notification type"
        items={TABS}
        active={tab}
        hrefFor={(id) => (id === "all" ? ROUTES.notifications : `${ROUTES.notifications}?tab=${id}`)}
      />
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={BellOff} title="You're all caught up" description="New alerts, comments and messages will show up here." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`n-${g.label}`} className="rounded-2xl border border-border bg-card p-2">
              <h2 id={`n-${g.label}`} className="px-3 pt-2 pb-1 text-sm font-bold text-muted-foreground">
                {g.label}
              </h2>
              {g.items.map((n) => (
                <NotificationItem key={n._id} item={n} onOpen={(id) => void markRead(id)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
