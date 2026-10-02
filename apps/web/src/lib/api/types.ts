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

/**
 * Post document as the API returns it. The first-class fields (contract §1)
 * are optional so the mock store's legacy-shaped seed data still type-checks;
 * the live API always sends them, and `content` keeps the encoded form.
 */
export interface ApiPost {
  _id: string;
  authorUid: string;
  neighborhoodId: string;
  type: PostType;
  content: string;
  mediaUrls: string[];
  /** width ÷ height of each `mediaUrls` entry, or null when the API doesn't know (a pasted link). Frames media before it loads. */
  mediaAspects?: (number | null)[];
  /** @deprecated always [] from the live API; use reactionTotal / myReaction. */
  likes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { uid: string; displayName: string; photoURL?: string; neighborhoodName?: string };
  message?: string;
  category?: PostCategory;
  alertCategory?: AlertCategory;
  urgent?: boolean;
  eventDate?: string;
  eventLocation?: string;
  thankedName?: string;
  priceNaira?: number | null;
  poll?: PollDefinition;
  pollResults?: PollResults;
  visibility?: PostVisibility;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  reactionTotal?: number;
  myReaction?: ReactionType | null;
  commentCount?: number;
  commentsDisabled?: boolean;
  activeUntil?: string;
  resolvedAt?: string | null;
}

/**
 * A post's typed fields (category, event date, poll…). The API stores and
 * returns them as first-class fields; the web still *sends* them inside
 * `content` behind a machine-readable prefix (lib/api/post-meta.ts), which
 * the API parses on the way in.
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
  commentCount: number;
  /** All reactions of every type. */
  reactionTotal: number;
  /** The viewer's own reaction type. */
  myReaction: ReactionType | null;
  /** When an alert was marked resolved (alerts only). */
  resolvedAt: string | null;
}

export interface CreatePostInput {
  message: string;
  meta: PostMeta;
  /** Up to 10 photo URLs (from POST /media or pasted). */
  mediaUrls?: string[];
}

// ── People ──────────────────────────────────────────────────────────────────

/** live: GET /users/:uid/public */
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
  /** Embedded by the live API. */
  author?: { uid: string; displayName: string; photoURL?: string };
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
export type ListingStatus = "available" | "pending" | "sold";

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
  /** width ÷ height of each photo, or null when the API doesn't know (a pasted link). Frames a photo before it loads. */
  photoAspects?: (number | null)[];
  status: ListingStatus;
  createdAt: string;
  /** Embedded by the live API. */
  seller?: { uid: string; displayName: string; photoURL?: string };
}

export type CreateListingInput = Omit<
  Listing,
  "_id" | "sellerUid" | "neighborhoodId" | "status" | "createdAt" | "seller"
>;

// ── Groups (planned) ────────────────────────────────────────────────────────

export type GroupCategory = "safety" | "estate" | "parents" | "hobbies" | "business" | "other";
export type GroupPrivacy = "open" | "private";
/** Who can find the group in their Groups list (Nextdoor "boundary"). */
export type GroupBoundary = "neighbourhood" | "nearby" | "city";

export interface Group {
  _id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  category: GroupCategory;
  boundary: GroupBoundary;
  coverPhoto?: string;
  memberCount: number;
  neighborhoodId: string;
  createdBy: string;
  /** Run by an estate / residents' association account. */
  official: boolean;
  /** Viewer-relative. */
  membership: "member" | "requested" | "none";
  /** Viewer-relative: can manage the group. */
  isAdmin: boolean;
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
  description: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  boundary: GroupBoundary;
  coverPhoto?: string;
}

export type UpdateGroupInput = Partial<CreateGroupInput>;

export interface GroupMember {
  uid: string;
  role: "admin" | "member";
  joinedAt: string;
}

export interface GroupJoinRequest {
  uid: string;
  requestedAt: string;
}

export interface GroupPost {
  _id: string;
  groupId: string;
  authorUid: string;
  /** Embedded by the live API. */
  author?: { uid: string; displayName: string; photoURL?: string };
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
  /** The event is over: RSVPs are closed (contract §23). */
  ended?: boolean;
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
  /** Embedded by the live API (names/photos of both people). */
  participants?: { uid: string; displayName: string; photoURL?: string }[];
  /** When each person last read the thread (for "Seen"). */
  readBy?: { uid: string; lastReadAt?: string }[];
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
  | "verification"
  /** Staff decisions about your account or content. */
  | "moderation"
  /** Team announcements (admin broadcasts). */
  | "system";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  /** Finer meaning, e.g. "event_reminder_final" opens the reminder pop-up (contract §23). */
  kind?: "event_reminder" | "event_reminder_final" | "event_followup";
  /** What it's about (e.g. the event's post id). */
  subjectId?: string;
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

// ── Nearby-neighbourhood requests (docs/api-contract.md §16) ────────────────

/** An open Hood close to (but not covering) an address. Nearest first, max 3. */
export interface NearbyHood {
  id: string;
  name: string;
  city: string;
  /** From the verified point to the Hood, rounded. */
  distanceMeters: number;
}

/** Result of POST /users/me/verify-location. */
export interface VerifyLocationResult {
  verificationStatus: string;
  neighborhoodId?: string;
  distanceMeters?: number;
  reason?: string;
  /** Only when reason is "outside_coverage"; [] when nothing is close. */
  nearbyHoods?: NearbyHood[];
}
