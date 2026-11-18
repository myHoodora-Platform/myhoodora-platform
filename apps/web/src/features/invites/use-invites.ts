"use client";

import { useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import type { InviteSummary } from "@myhoodora/api-contract/invites";
import type { EngagementSummary } from "@myhoodora/api-contract/engagement";
import { getInviteSummary } from "@/lib/api/invites";
import { getEngagement } from "@/lib/api/engagement";
import { rememberMyBadge } from "@/lib/api/users";
import { rememberMyInviteCode } from "./invite-ref";

/**
 * The signed-in neighbour's invite summary, loaded once per session (InviteBootstrap) and shared by
 * the "Who invited you?" card, the Invite page and share links.
 */
let state: { uid: string | null; summary: InviteSummary | null; engagement: EngagementSummary | null } = { uid: null, summary: null, engagement: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadInvites(user: User): Promise<InviteSummary | null> {
  const [summary, engagement] = await Promise.all([getInviteSummary(user), getEngagement(user).catch(() => null)]);
  if (summary) rememberMyInviteCode(summary.code);
  rememberMyBadge(engagement?.badge ?? undefined);
  state = { uid: user.uid, summary, engagement };
  emit();
  return summary;
}

export function patchInvites(change: Partial<InviteSummary>): void {
  if (!state.summary) return;
  state = { ...state, summary: { ...state.summary, ...change } };
  emit();
}

export function resetInvites(): void {
  state = { uid: null, summary: null, engagement: null };
  emit();
}

export function useInviteSummary(uid: string | undefined): InviteSummary | null {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  return uid && snap.uid === uid ? snap.summary : null;
}

/** Their streak, challenge progress and badge (loaded with the invites). */
export function useEngagement(uid: string | undefined): EngagementSummary | null {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  return uid && snap.uid === uid ? snap.engagement : null;
}
