import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, save } from "./mock/store";
import type { EventRsvpSummary, RsvpStatus } from "./types";

const rsvpKey = (uid: string) => `rsvp:${uid}`;

/** Stable pseudo-count so preview events don't all show "0 going". */
function baseCount(postId: string, salt: number): number {
  let h = salt;
  for (const ch of postId) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 23;
}

/** planned: GET /posts/:id/rsvp → { goingCount, interestedCount, myStatus } */
export async function getRsvp(user: User, postId: string): Promise<EventRsvpSummary> {
  if (isLive("events.rsvp")) return apiFetch<EventRsvpSummary>(user, `/posts/${postId}/rsvp`);
  await latency(150);
  const myStatus = load<Record<string, RsvpStatus>>(rsvpKey(user.uid), () => ({}))[postId] ?? null;
  return {
    postId,
    goingCount: baseCount(postId, 7) + (myStatus === "going" ? 1 : 0),
    interestedCount: baseCount(postId, 13) + (myStatus === "interested" ? 1 : 0),
    myStatus,
  };
}

/** planned: PUT /posts/:id/rsvp { status } | DELETE /posts/:id/rsvp */
export async function setRsvp(
  user: User,
  postId: string,
  status: RsvpStatus | null,
): Promise<EventRsvpSummary> {
  if (isLive("events.rsvp")) {
    return status
      ? apiFetch<EventRsvpSummary>(user, `/posts/${postId}/rsvp`, { method: "PUT", json: { status } })
      : apiFetch<EventRsvpSummary>(user, `/posts/${postId}/rsvp`, { method: "DELETE" });
  }
  const map = { ...load<Record<string, RsvpStatus>>(rsvpKey(user.uid), () => ({})) };
  if (status) map[postId] = status;
  else delete map[postId];
  save(rsvpKey(user.uid), map);
  return getRsvp(user, postId);
}
