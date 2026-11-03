import type { User } from "@firebase/auth";
import type { EventRsvpSummary, RsvpStatus } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

/** Contract §7: Going or Interested, or neither (`null`). 409 once the event has ended. */
export function setRsvp(user: User, postId: string, status: RsvpStatus | null): Promise<EventRsvpSummary> {
  return status
    ? apiFetch<EventRsvpSummary>(user, `/posts/${postId}/rsvp`, { method: "PUT", json: { status } })
    : apiFetch<EventRsvpSummary>(user, `/posts/${postId}/rsvp`, { method: "DELETE" });
}

/** The counts after changing your answer from `from` to `to`, shown before the API replies. */
export function withRsvp(s: EventRsvpSummary, to: RsvpStatus | null): EventRsvpSummary {
  const from = s.myStatus;
  const count = (k: RsvpStatus) => (k === "going" ? s.goingCount : s.interestedCount) - (from === k ? 1 : 0) + (to === k ? 1 : 0);
  return { ...s, goingCount: Math.max(0, count("going")), interestedCount: Math.max(0, count("interested")), myStatus: to };
}
