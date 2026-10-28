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
  /** Events: RSVP counts and your own answer, sent with the post so a list needs no request per card. */
  rsvp?: EventRsvpSummary;
  visibility?: PostVisibility;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  reactionTotal?: number;
  myReaction?: ReactionType | null;
  commentCount?: number;
  /** Different neighbours who shared it. */
  shareCount?: number;
  /** You saved it (GET /posts/saved lists them). */
  saved?: boolean;
  /** You hear about new comments on it: its author unless muted, others once they follow it. */
  following?: boolean;
  /** When the author last edited the text, or null. */
  editedAt?: string | null;
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
  /**
   * Makes a retry safe: the same id again returns the post created the first
   * time instead of a second one (see lib/api/submission-id.ts).
   */
  clientId?: string;
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
  /** A reply: the top-level comment it sits under (one level), and whom it answers. */
  parentId?: string;
  replyToUid?: string;
  /** Sent by the live API (contract §2); optional for older payloads. */
  likeCount?: number;
  replyCount?: number;
  /** Whether you like it. */
  liked?: boolean;
  /** A deleted comment kept as a placeholder because it has replies (no author, no words). */
  deleted?: boolean;
}

export type CommentSort = "top" | "newest" | "oldest";

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

// ── Groups (§8) ────────────────────────────────────────────────────────

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
  /** Sent by the live API since 2026-10-28. */
  displayName?: string;
  photoURL?: string;
}

export interface GroupJoinRequest {
  uid: string;
  requestedAt: string;
  displayName?: string;
  photoURL?: string;
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
  /** The people behind it, most recent first (up to three): faces for the row. */
  actors?: { uid: string; displayName: string; photoURL?: string }[];
  /** How many people in all, when more than one (a grouped row: "Ada and 3 others"). */
  actorCount?: number;
  /** A picture of what it's about (the post's first photo), when there is one. */
  preview?: { image: string };
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

/** Result of POST /users/me/verify-location/preview: what verifying at a point would do, without doing it. */
export interface LocationPreview {
  /** The Hood the point would join, or null when it's outside every Hood. */
  hood: { id: string; name: string; city: string } | null;
  distanceMeters?: number;
  /** Outside every Hood: the close ones, to ask to join. */
  nearbyHoods: NearbyHood[];
  /** Why joining `hood` would be refused (a verified neighbour moving Hood too soon). */
  cannotJoin?: string;
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

/** `GET /users/me`: the signed-in person (contract §10, §16). */
export interface UserProfile {
  uid?: string;
  email?: string;
  /** False until the neighbour clicks the link in their welcome email (Google/Apple: true at once). */
  emailVerified?: boolean;
  isOnboarded: boolean;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  neighborhoodId?: string;
  verificationStatus?: string;
  /** Separate from verification: active | restricted | suspended (contract §13). */
  accountStatus?: "active" | "restricted" | "suspended";
  restrictedUntil?: string | null;
  role?: string;
  /** Set while a request to join a nearby Hood awaits staff review (verificationStatus "pending_review"). */
  requestedHood?: { id: string; name: string; requestedAt: string } | null;
  /** Hoods they may read and hear alerts from besides home (contract §31). Never for posting. */
  secondaryHoods?: { id: string; name: string; city?: string; since: string }[];
}

// ── Neighbourhood requests (contract §31) ───────────────────────────────────

export type HoodRequestKind = "secondary" | "move";
export type HoodRequestStatus = "pending" | "approved" | "declined" | "withdrawn" | "removed";
export interface HoodRef {
  id: string;
  name: string;
  city?: string;
}

/** A neighbour's own request, as they see it. */
export interface HoodRequestView {
  id: string;
  kind: HoodRequestKind;
  status: HoodRequestStatus;
  /** Secondary: the Hood asked for. Move: the Hood the new address is in, if any. */
  hood: HoodRef | null;
  reason: string;
  /** Why it was declined or removed. */
  decisionNote?: string;
  /** The support conversation staff opened about it. */
  threadId?: string;
  createdAt: string;
  decidedAt?: string;
}

/** GET /users/me/hoods */
export interface MyHoods {
  home: HoodRef | null;
  secondary: (HoodRef & { since: string })[];
  requests: HoodRequestView[];
  maxSecondary: number;
}

/** GET /admin/hood-requests items. `address` and `point` only for staff who may see addresses. */
export interface AdminHoodRequest extends HoodRequestView {
  neighbour: { uid: string; displayName: string; photoURL?: string };
  home: HoodRef | null;
  secondaryCount: number;
  address?: string;
  point?: { lat: number; lng: number };
  decidedBy?: string;
}
