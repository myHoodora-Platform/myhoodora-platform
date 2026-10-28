import type { AlertCategory, PostCategory } from "@myhoodora/api-contract/types";
import type { NewPost } from "@/features/feed/feed-api";
import { eventDateProblem } from "@/features/events/event-time";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/features/polls/polls-api";

/** What the app's composer offers (For Sale has its own screen: Sell). */
export const COMPOSE_KINDS: { id: PostCategory; label: string; hint: string; placeholder: string }[] = [
  { id: "general", label: "General", hint: "Share an update or ask neighbours a question", placeholder: "What's happening in your neighbourhood?" },
  { id: "recommendation", label: "Recommendation", hint: "Find a trusted electrician, tailor, school…", placeholder: "Who do neighbours recommend for…" },
  { id: "alert", label: "Alert", hint: "Security, power, flooding, traffic, scams", placeholder: "What's happening, and where?" },
  { id: "event", label: "Event", hint: "A clean-up, a residents' meeting, a party. The first line is its title", placeholder: "Estate clean-up. Bring gloves; we'll provide bags and drinks." },
  { id: "poll", label: "Poll", hint: "Ask neighbours to choose. Votes are anonymous", placeholder: "Should we hire a second night guard for our street?" },
  { id: "lost_found", label: "Lost & found", hint: "Lost keys, a missing pet, found items", placeholder: "What was lost or found, and where?" },
  { id: "thanks", label: "Thanks", hint: "Shout out someone who made a difference", placeholder: "What did they do?" },
];

/** The web's alert kinds, adapted for Nigeria. */
export const ALERT_KINDS: { id: AlertCategory; label: string }[] = [
  { id: "security", label: "Security" },
  { id: "power", label: "Power" },
  { id: "water", label: "Water" },
  { id: "flooding", label: "Flooding" },
  { id: "traffic", label: "Traffic" },
  { id: "fire", label: "Fire" },
  { id: "scam", label: "Scam warning" },
  { id: "other", label: "Other" },
];

/** The API's limit for `message` (contract §1). */
export const MESSAGE_MAX = 8192;

export interface Draft {
  category: PostCategory;
  message: string;
  alertCategory: AlertCategory | null;
  urgent: boolean;
  thankedName: string;
  eventDate: Date | null;
  eventLocation: string;
  /** As typed; blanks are dropped when sending. */
  pollOptions: string[];
  pollDays: number;
}

export const blankDraft = (category: PostCategory = "general"): Draft => ({
  category,
  message: "",
  alertCategory: null,
  urgent: false,
  thankedName: "",
  eventDate: null,
  eventLocation: "",
  pollOptions: ["", ""],
  pollDays: 3,
});

/** The kinds a link can open the composer on (`/compose?kind=event`). */
export function kindFromParam(kind: unknown): PostCategory {
  return COMPOSE_KINDS.some((k) => k.id === kind) ? (kind as PostCategory) : "general";
}

export type DraftErrors = Partial<Record<"message" | "alertCategory" | "thankedName" | "eventDate" | "eventLocation" | "pollOptions", string>>;

const filledOptions = (d: Draft) => d.pollOptions.map((o) => o.trim()).filter(Boolean);

/** The API's rules, checked before sending: alerts need a kind, thanks a name, events a date, polls 2–4 different choices. */
export function draftErrors(d: Draft, now = new Date()): DraftErrors | null {
  const errors: DraftErrors = {};
  const text = d.message.trim();
  if (!text) errors.message = "Write something for your neighbours.";
  else if (text.length > MESSAGE_MAX) errors.message = `Please keep it to ${MESSAGE_MAX.toLocaleString("en")} characters.`;
  if (d.category === "alert" && !d.alertCategory) errors.alertCategory = "Choose what kind of alert this is.";
  if (d.category === "thanks" && !d.thankedName.trim()) errors.thankedName = "Who are you thanking?";
  if (d.category === "event") {
    const problem = eventDateProblem(d.eventDate, now);
    if (problem) errors.eventDate = problem;
    if (d.eventLocation.length > 200) errors.eventLocation = "Keep the place to 200 characters.";
  }
  if (d.category === "poll") {
    const options = filledOptions(d);
    if (options.length < POLL_MIN_OPTIONS) errors.pollOptions = "Add at least 2 choices.";
    else if (options.length > POLL_MAX_OPTIONS) errors.pollOptions = "Polls can have up to 4 choices.";
    else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) errors.pollOptions = "Each choice must be different.";
    else if (options.some((o) => o.length > 60)) errors.pollOptions = "Keep each choice to 60 characters.";
  }
  return Object.keys(errors).length ? errors : null;
}

/** Only the fields this kind of post uses. */
export function toNewPost(d: Draft, clientId: string, now = Date.now()): NewPost {
  return {
    message: d.message.trim(),
    category: d.category,
    clientId,
    ...(d.category === "alert" && { alertCategory: d.alertCategory ?? "other", urgent: d.urgent }),
    ...(d.category === "thanks" && { thankedName: d.thankedName.trim() }),
    ...(d.category === "event" && d.eventDate && { type: "event" as const, eventDate: d.eventDate.toISOString(), ...(d.eventLocation.trim() && { eventLocation: d.eventLocation.trim() }) }),
    ...(d.category === "poll" && {
      poll: { options: filledOptions(d).map((text, i) => ({ id: `o${i + 1}`, text })), closesAt: new Date(now + d.pollDays * 86_400_000).toISOString() },
    }),
  };
}

/** 8–64 letters and digits, as the API's clientId requires. */
export function newClientId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
