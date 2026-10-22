import type { AlertCategory, PostCategory } from "@myhoodora/api-contract/types";
import type { NewPost } from "@/features/feed/feed-api";

/** What the app's composer offers (events, polls and For Sale come with their own screens later). */
export const COMPOSE_KINDS: { id: PostCategory; label: string; hint: string; placeholder: string }[] = [
  { id: "general", label: "General", hint: "Share an update or ask neighbours a question", placeholder: "What's happening in your neighbourhood?" },
  { id: "recommendation", label: "Recommendation", hint: "Find a trusted electrician, tailor, school…", placeholder: "Who do neighbours recommend for…" },
  { id: "alert", label: "Alert", hint: "Security, power, flooding, traffic, scams", placeholder: "What's happening, and where?" },
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
}

export type DraftErrors = Partial<Record<"message" | "alertCategory" | "thankedName", string>>;

/** The API's rules, checked before sending: alerts need a kind, thanks a name. */
export function draftErrors(d: Draft): DraftErrors | null {
  const errors: DraftErrors = {};
  const text = d.message.trim();
  if (!text) errors.message = "Write something for your neighbours.";
  else if (text.length > MESSAGE_MAX) errors.message = `Please keep it to ${MESSAGE_MAX.toLocaleString("en")} characters.`;
  if (d.category === "alert" && !d.alertCategory) errors.alertCategory = "Choose what kind of alert this is.";
  if (d.category === "thanks" && !d.thankedName.trim()) errors.thankedName = "Who are you thanking?";
  return Object.keys(errors).length ? errors : null;
}

/** Only the fields this kind of post uses. */
export function toNewPost(d: Draft, clientId: string): NewPost {
  return {
    message: d.message.trim(),
    category: d.category,
    clientId,
    ...(d.category === "alert" && { alertCategory: d.alertCategory ?? "other", urgent: d.urgent }),
    ...(d.category === "thanks" && { thankedName: d.thankedName.trim() }),
  };
}

/** 8–64 letters and digits, as the API's clientId requires. */
export function newClientId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
