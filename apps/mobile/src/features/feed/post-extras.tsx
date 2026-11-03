import type { ApiPost } from "@myhoodora/api-contract/types";
import { EventBlock } from "@/features/events/event-details";
import { PollBlock } from "@/features/polls/poll-block";

/** What some posts carry besides text and photos: an event's when, where and RSVP; a poll. */
export function PostExtras({ post }: { post: ApiPost }) {
  if (post.poll?.options?.length) return <PollBlock post={post} poll={post.poll} />;
  if (post.category === "event") return <EventBlock post={post} />;
  return null;
}
