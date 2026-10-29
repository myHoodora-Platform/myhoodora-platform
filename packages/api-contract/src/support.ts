/** Support conversations (contract §18), shared by the web and the app. */

export const SUPPORT_TOPICS = [
  { id: "account", label: "My account" },
  { id: "verification", label: "Address verification" },
  { id: "safety", label: "A safety concern" },
  { id: "bug", label: "Something isn't working" },
  { id: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["id"];

export type SupportStatus = "open" | "waiting" | "resolved";

/** A photo or PDF in a support conversation (2026-10-28). Uploaded with POST /media purpose "support". */
export interface SupportAttachment {
  url: string;
  kind: "image" | "document";
  /** The file's name, for documents ("Utility bill.pdf"). */
  name?: string;
  bytes?: number;
}

/** Per message, either way (neighbour or team). */
export const SUPPORT_ATTACHMENTS_MAX = 4;

export interface SupportMessage {
  from: "user" | "staff";
  /** May be empty when the message is only attachments. */
  body: string;
  at: string;
  /** Staff member's name on team messages. */
  by?: string;
  attachments?: SupportAttachment[];
}

export interface SupportThread {
  id: string;
  subject: string;
  topic: string;
  status: SupportStatus;
  startedBy: "user" | "staff";
  messages: SupportMessage[];
  unread: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupportThreadSummary = Omit<SupportThread, "messages"> & { lastMessage?: SupportMessage };

/** The Help centre's questions, shown by the web (/help) and the app (Menu → Help centre). */
export const HELP_FAQS: readonly { q: string; a: string }[] = [
  {
    q: "Why do I need to verify my address?",
    a: "myHoodora only works if everyone is a real neighbour. Verifying confirms you live in your neighbourhood and unlocks Alerts, Events, Groups and For Sale & Free.",
  },
  {
    q: "Who can see my posts?",
    a: "Verified neighbours in your neighbourhood. Your exact address is never shown, only your neighbourhood name.",
  },
  {
    q: "When should I use an urgent alert?",
    a: "Only for something happening right now that puts neighbours at risk, like a break-in in progress, a fire or dangerous flooding. Urgent alerts show a red banner to everyone for 2 hours.",
  },
  {
    q: "How do I stay safe buying and selling?",
    a: "Meet in a public place such as your estate gate, inspect the item before paying, and never send money to someone you haven't met.",
  },
  {
    q: "How do I report something?",
    a: "Use the ••• menu on any post, or “Report” on comments, listings and messages. Reports are private: volunteer Hood Leads or the myHoodora team review them, and nobody is told who reported. You can see the outcome, and appeal it, in Settings → Decisions & appeals.",
  },
  {
    q: "How do I change my neighbourhood?",
    a: "Moving to a new neighbourhood isn't self-serve yet. Send us a message below and we'll move you over after verifying your new address.",
  },
];
