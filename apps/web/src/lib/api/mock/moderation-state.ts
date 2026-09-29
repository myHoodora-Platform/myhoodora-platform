/**
 * Content hidden by moderators, shared between the admin and the app in
 * mock mode — so removing a post in /admin/moderation hides it in the feed,
 * exactly as the real backend will (planned: isActive=false + removal record).
 */
import { load, save } from "./store";

export type ModeratedType = "post" | "comment" | "listing" | "group";

const KEY = "moderation-removed";

function all(): Record<string, string> {
  return load<Record<string, string>>(KEY, () => ({}));
}

export function isRemoved(type: ModeratedType, id: string): boolean {
  return Boolean(all()[`${type}:${id}`]);
}

export function setRemoved(type: ModeratedType, id: string, removed: boolean) {
  const next = { ...all() };
  if (removed) next[`${type}:${id}`] = new Date().toISOString();
  else delete next[`${type}:${id}`];
  save(KEY, next);
}

export function removedAt(type: ModeratedType, id: string): string | null {
  return all()[`${type}:${id}`] ?? null;
}
