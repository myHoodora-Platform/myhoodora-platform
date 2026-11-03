import type { User } from "@firebase/auth";
import type { AppNotification } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export function listNotifications(user: User): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>(user, "/notifications");
}

export function markRead(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/notifications/${id}`, { method: "PATCH", json: { read: true } });
}

export function markAllRead(user: User): Promise<void> {
  return apiFetch<void>(user, "/notifications/read-all", { method: "POST" });
}
