import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";

export const SUPPORT_TOPICS = [
  { id: "account", label: "My account" },
  { id: "verification", label: "Address verification" },
  { id: "safety", label: "A safety concern" },
  { id: "bug", label: "Something isn't working" },
  { id: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["id"];

/**
 * live: POST /support { topic, message } → { id, status: "received" }.
 * Lands in the team inbox; replies arrive by email and notification.
 */
export async function submitSupportRequest(user: User, input: { topic: SupportTopic; message: string }): Promise<{ id: string }> {
  if (isLive("support")) return apiFetch<{ id: string }>(user, "/support", { method: "POST", json: input });
  await latency(400);
  const id = mockId("sup");
  save("support-requests", [...load<object[]>("support-requests", () => []), { ...input, id, uid: user.uid, at: new Date().toISOString() }]);
  return { id };
}
