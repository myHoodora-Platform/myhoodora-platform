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

export interface SupportMessage {
  from: "user" | "staff";
  body: string;
  at: string;
  /** Staff member's name on team messages. */
  by?: string;
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
