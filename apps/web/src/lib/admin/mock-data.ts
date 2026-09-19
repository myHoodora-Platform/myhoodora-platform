// Demo data for the admin panel. No backend endpoints exist yet for
// user-listing, support queries, or notifications — this mirrors the same
// honest-mock-data precedent already used for the dashboard feed and the
// Safety Watch / Events / Marketplace pages. Real data (neighborhoods, the
// logged-in admin's own profile) is fetched separately in AdminDataContext.

export type UserRole = "member" | "admin" | "moderator";
export type VerificationStatus = "verified" | "unverified" | "banned";

export interface MockUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  neighborhoodName?: string;
  joinedAt: string;
}

export const MOCK_USERS: MockUser[] = [
  { uid: "u1", displayName: "Adaeze Okafor", email: "adaeze.okafor@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Ikeja, Lagos", joinedAt: "2026-06-12" },
  { uid: "u2", displayName: "Tunde Bakare", email: "tunde.bakare@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Victoria Island, Lagos", joinedAt: "2026-06-18" },
  { uid: "u3", displayName: "Ngozi Eze", email: "ngozi.eze@example.com", role: "moderator", verificationStatus: "verified", neighborhoodName: "Ikoyi, Lagos", joinedAt: "2026-05-02" },
  { uid: "u4", displayName: "Chidi Nwosu", email: "chidi.nwosu@example.com", role: "member", verificationStatus: "unverified", joinedAt: "2026-09-10" },
  { uid: "u5", displayName: "Folake Adeyemi", email: "folake.adeyemi@example.com", role: "member", verificationStatus: "unverified", joinedAt: "2026-09-14" },
  { uid: "u6", displayName: "Emeka Chukwu", email: "emeka.chukwu@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Lekki Phase 1, Lagos", joinedAt: "2026-07-21" },
  { uid: "u7", displayName: "Bisi Ogundipe", email: "bisi.ogundipe@example.com", role: "member", verificationStatus: "banned", neighborhoodName: "Yaba, Lagos", joinedAt: "2026-04-30" },
  { uid: "u8", displayName: "Ifeanyi Obi", email: "ifeanyi.obi@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Surulere, Lagos", joinedAt: "2026-08-03" },
  { uid: "u9", displayName: "Amara Nnamdi", email: "amara.nnamdi@example.com", role: "member", verificationStatus: "unverified", joinedAt: "2026-09-15" },
  { uid: "u10", displayName: "Segun Adekunle", email: "segun.adekunle@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Bodija, Ibadan", joinedAt: "2026-06-27" },
  { uid: "u11", displayName: "Grace Okonkwo", email: "grace.okonkwo@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Dugbe, Ibadan", joinedAt: "2026-07-09" },
  { uid: "u12", displayName: "Yusuf Aliyu", email: "yusuf.aliyu@example.com", role: "member", verificationStatus: "banned", neighborhoodName: "Ajah, Lagos", joinedAt: "2026-05-14" },
  { uid: "u13", displayName: "Chioma Eze", email: "chioma.eze@example.com", role: "admin", verificationStatus: "verified", neighborhoodName: "Ikeja, Lagos", joinedAt: "2026-01-05" },
  { uid: "u14", displayName: "Kunle Bello", email: "kunle.bello@example.com", role: "member", verificationStatus: "unverified", joinedAt: "2026-09-16" },
  { uid: "u15", displayName: "Halima Sani", email: "halima.sani@example.com", role: "member", verificationStatus: "verified", neighborhoodName: "Magodo, Lagos", joinedAt: "2026-08-22" },
  { uid: "u16", displayName: "Peter Udoh", email: "peter.udoh@example.com", role: "member", verificationStatus: "unverified", joinedAt: "2026-09-11" },
];

export type QueryStatus = "open" | "in_progress" | "resolved";
export type QueryPriority = "low" | "normal" | "high";

export interface MockQuery {
  id: string;
  uid: string;
  userName: string;
  subject: string;
  message: string;
  status: QueryStatus;
  priority: QueryPriority;
  createdAt: string;
  adminResponse?: string;
}

export const MOCK_QUERIES: MockQuery[] = [
  { id: "q1", uid: "u4", userName: "Chidi Nwosu", subject: "Can't verify my address", message: "I tried using my current location three times and it keeps failing. My address is correct on the map though.", status: "open", priority: "high", createdAt: "2026-09-16T09:10:00Z" },
  { id: "q2", uid: "u9", userName: "Amara Nnamdi", subject: "Wrong neighbourhood assigned", message: "I live in Gbagada but the app matched me to a neighbourhood on the other side of Lagos.", status: "open", priority: "normal", createdAt: "2026-09-15T14:22:00Z" },
  { id: "q3", uid: "u16", userName: "Peter Udoh", subject: "Marketplace listing not showing", message: "I posted an item for sale yesterday but I don't see it anywhere in the marketplace.", status: "in_progress", priority: "normal", createdAt: "2026-09-14T11:05:00Z" },
  { id: "q4", uid: "u7", userName: "Bisi Ogundipe", subject: "Why was my account restricted?", message: "I woke up and I can't post anymore. Can someone tell me what happened?", status: "in_progress", priority: "high", createdAt: "2026-09-13T08:40:00Z" },
  { id: "q5", uid: "u2", userName: "Tunde Bakare", subject: "Feature request: dark mode", message: "Loving the app so far! Would be great to have a dark mode option for night use.", status: "resolved", priority: "low", createdAt: "2026-09-10T19:15:00Z", adminResponse: "Thanks for the suggestion — we've added it to our roadmap!" },
  { id: "q6", uid: "u14", userName: "Kunle Bello", subject: "Email not receiving verification code", message: "I never got the password reset email even after retrying twice.", status: "resolved", priority: "normal", createdAt: "2026-09-08T16:30:00Z", adminResponse: "Found it — it was flagged by your provider's spam filter. Should be resolved now." },
];

export interface MockNotification {
  id: string;
  title: string;
  body: string;
  audience: "all" | "user" | "neighborhood";
  audienceLabel: string;
  sentAt: string;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  { id: "n1", title: "Scheduled maintenance tonight", body: "myHoodora will be briefly unavailable between 1–2am WAT for scheduled maintenance.", audience: "all", audienceLabel: "All users", sentAt: "2026-09-15T20:00:00Z" },
  { id: "n2", title: "New Safety Watch feature", body: "You can now join your neighbourhood's Safety Watch group directly from the sidebar.", audience: "neighborhood", audienceLabel: "Ikeja, Lagos", sentAt: "2026-09-12T10:00:00Z" },
];

export interface MockActivity {
  id: string;
  text: string;
  timestamp: string;
}

export const MOCK_ACTIVITY: MockActivity[] = [
  { id: "a1", text: "You verified Segun Adekunle", timestamp: "2026-09-16T08:15:00Z" },
  { id: "a2", text: "You restricted Yusuf Aliyu", timestamp: "2026-09-15T17:40:00Z" },
  { id: "a3", text: "You responded to a support query from Tunde Bakare", timestamp: "2026-09-10T19:20:00Z" },
];
