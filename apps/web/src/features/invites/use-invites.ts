"use client";

import { useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import type { InviteSummary } from "@myhoodora/api-contract/invites";
import { getInviteSummary } from "@/lib/api/invites";
import { rememberMyInviteCode } from "./invite-ref";

/**
 * The signed-in neighbour's invite summary, loaded once per session (InviteBootstrap) and shared by
 * the "Who invited you?" card, the Invite page and share links.
 */
let state: { uid: string | null; summary: InviteSummary | null } = { uid: null, summary: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadInvites(user: User): Promise<InviteSummary | null> {
  const summary = await getInviteSummary(user);
  if (summary) rememberMyInviteCode(summary.code);
  state = { uid: user.uid, summary };
  emit();
  return summary;
}

export function patchInvites(change: Partial<InviteSummary>): void {
  if (!state.summary) return;
  state = { ...state, summary: { ...state.summary, ...change } };
  emit();
}

export function resetInvites(): void {
  state = { uid: null, summary: null };
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
