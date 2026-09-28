/**
 * Domain types shared by the UI and the API services. Anything marked
 * "planned" is the shape the frontend expects the backend to return once the
 * endpoint exists — docs/api-contract.md is generated from these.
 */

// ── Posts ───────────────────────────────────────────────────────────────────

/** Backend enum today (apps/api/src/posts/schemas/post.schema.ts). */
export type PostType = "text" | "image" | "event" | "alert";

/** What the neighbour chose in the composer (Nextdoor-style post categories). */
export type PostCategory =
  | "general"
  | "recommendation"
  | "for_sale"
  | "alert"
  | "event"
  | "lost_found"
  | "thanks"
  | "poll";

export type AlertCategory =
  | "security"
  | "power"
  | "water"
  | "flooding"
  | "traffic"
  | "fire"
  | "scam"
  | "other";

/** Who can see a post. Fixed at creation (same rule as Nextdoor). */
export type PostVisibility = "neighbourhood" | "nearby" | "anyone";

export type ReactionType = "like" | "helpful" | "agree" | "haha" | "wow" | "sad";

/** Raw post document as the API returns it today. */
export interface ApiPost {
  _id: string;
  authorUid: string;
  neighborhoodId: string;
  type: PostType;
  content: string;
  mediaUrls: string[];
  likes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fields the Post schema doesn't have yet. Until it does, they round-trip
 * inside `content` behind a machine-readable prefix (lib/api/post-meta.ts);
 * planned: first-class fields on the Post document.
 */
export interface PostMeta {
  category: PostCategory;
  alertCategory?: AlertCategory;
  /** Critical alerts take over the app with a red banner for 2 hours. */
  urgent?: boolean;
  eventDate?: string; // ISO datetime
  eventLocation?: string;
  visibility?: PostVisibility;
  /** #ThankANeighbour — who is being thanked. */
  thankedName?: string;
  /** Sell or give away posts. */
  priceNaira?: number | null;
  /** Poll posts: the question is the post message. */
  poll?: PollDefinition;
}

// ── Polls (planned votes endpoint) ──────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
}

export interface PollDefinition {
  /** 2–4 options, like Nextdoor/Twitter polls. */
  options: PollOption[];
  closesAt: string; // ISO
}

/** Votes are anonymous: only counts and the viewer's own choice are returned. */
export interface PollResults {
  postId: string;
  counts: Record<string, number>;
  total: number;
  myVote: string | null;
  closed: boolean;
}

/** A post as the UI consumes it: API document + decoded meta + clean message. */
export interface Post extends ApiPost {
  message: string;
  meta: PostMeta;
  /** planned: returned by the API alongside the post. */
  commentCount: number;
  /** planned: the viewer's own reaction type (API only stores likes today). */
  myReaction: ReactionType | null;
  /** planned: when an alert was marked resolved (alerts only). */
  resolvedAt: string | null;
}

export interface CreatePostInput {
  message: string;
  meta: PostMeta;
  mediaUrl?: string;
}

// ── People ──────────────────────────────────────────────────────────────────

/** planned: GET /users/:uid/public */
export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  neighborhoodName?: string;
  /** ISO date the neighbour joined / verified in this neighbourhood. */
  neighbourSince?: string;
  bio?: string;
  verified: boolean;
  /** Organisations (estate management, agencies) get a badge. */
  kind?: "neighbour" | "organisation";
}

// ── Comments (planned) ──────────────────────────────────────────────────────

export interface Comment {
  _id: string;
  postId: string;
  authorUid: string;
  content: string;
  createdAt: string;
  likes: string[];
}

// ── For Sale & Free (planned) ───────────────────────────────────────────────

export type ListingCategory =
  | "furniture"
  | "electronics"
  | "home_appliances"
  | "fashion"
  | "kids"
  | "books"
  | "vehicles"
  | "other";

export type ListingCondition = "new" | "like_new" | "good" | "fair";

export interface Listing {
  _id: string;
  sellerUid: string;
  neighborhoodId: string;
  title: string;
  description: string;
  /** null = free. */
  priceNaira: number | null;
  negotiable: boolean;
  category: ListingCategory;
  condition: ListingCondition;
  photos: string[];
  status: "available" | "pending" | "sold";
  createdAt: string;
}

export type CreateListingInput = Omit<
  Listing,
  "_id" | "sellerUid" | "neighborhoodId" | "status" | "createdAt"
>;

// ── Groups (planned) ────────────────────────────────────────────────────────

export interface Group {
  _id: string;
  name: string;
  description: string;
  privacy: "open" | "private";
  category: "safety" | "estate" | "parents" | "hobbies" | "business" | "other";
  memberCount: number;
  neighborhoodId: string;
  /** Viewer-relative. */
  membership: "member" | "requested" | "none";
  createdAt: string;
}

export interface GroupPost {
  _id: string;
  groupId: string;
  authorUid: string;
  content: string;
  createdAt: string;
}

// ── Events (planned RSVP) ───────────────────────────────────────────────────

export type RsvpStatus = "going" | "interested";

export interface EventRsvpSummary {
  postId: string;
  goingCount: number;
  interestedCount: number;
  myStatus: RsvpStatus | null;
}

// ── Chat (planned) ──────────────────────────────────────────────────────────

export interface ConversationContext {
  type: "listing";
  id: string;
  title: string;
  photo?: string;
  priceNaira: number | null;
}

export interface Conversation {
  _id: string;
  participantUids: string[];
  context?: ConversationContext;
  lastMessage?: { body: string; senderUid: string; createdAt: string };
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderUid: string;
  body: string;
  createdAt: string;
}

// ── Notifications (planned) ─────────────────────────────────────────────────

export type NotificationType =
  | "alert"
  | "comment"
  | "reaction"
  | "message"
  | "event"
  | "group"
  | "verification";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  actorUid?: string;
  title: string;
  body?: string;
  href: string;
  createdAt: string;
  read: boolean;
}

// ── Reports (planned) ───────────────────────────────────────────────────────

export type ReportReason =
  | "spam"
  | "harassment"
  | "misinformation"
  | "scam"
  | "not_local"
  | "other";

export interface ReportInput {
  targetType: "post" | "comment" | "listing" | "message" | "user";
  targetId: string;
  reason: ReportReason;
  details?: string;
}
