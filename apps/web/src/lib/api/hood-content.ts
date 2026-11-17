import type { User } from "firebase/auth";
import type { ConversationStarter } from "@myhoodora/api-contract/hood-content";
import { apiFetch, withRetry } from "./client";
import { isLive } from "./config";

/** Preview mode has no content bank: a few starters so the chips can be seen. */
const PREVIEW_STARTERS: ConversationStarter[] = [
  { code: "S01", category: "general", text: "Let's get to know each other 👋 Introduce yourself: your first name, your street, and how long you've lived here." },
  { code: "S11", category: "recommendation", text: "Who's the most reliable electrician you've used around here? Share their name and what they fixed." },
  { code: "S46", category: "lost_found", text: "Lost something around here recently: keys, a phone, a pet? Post it here; neighbours are the fastest way to find it." },
];

/** live: GET /hood-content/starters — up to 6, filled in for the viewer's Hood ([] before joining one). */
export async function getStarters(user: User): Promise<ConversationStarter[]> {
  if (!isLive("hoodContent.starters")) return PREVIEW_STARTERS;
  return withRetry(() => apiFetch<ConversationStarter[]>(user, "/hood-content/starters"));
}
