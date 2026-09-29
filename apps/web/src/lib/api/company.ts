import { ApiError, FRIENDLY_MESSAGES } from "./client";
import { API_BASE_URL, isLive, type EndpointKey } from "./config";
import { latency, load, mockId, save } from "./mock/store";

// ── Contact ─────────────────────────────────────────────────────────────────

export const CONTACT_TOPICS = [
  { id: "general", label: "General question" },
  { id: "account", label: "Account & verification" },
  { id: "safety", label: "Safety concern" },
  { id: "business", label: "Business Pages & estates" },
  { id: "press", label: "Press & media" },
  { id: "partnerships", label: "Partnerships" },
  { id: "ai", label: "myHoodora AI" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["id"];

export function isContactTopic(v: unknown): v is ContactTopic {
  return CONTACT_TOPICS.some((t) => t.id === v);
}

export interface ContactMessage {
  topic: ContactTopic;
  name: string;
  email: string;
  message: string; // 20–2000
  organisation?: string; // press / partnerships
}

export interface ContactResult {
  id: string;
  status: "received";
}

/** planned: POST /contact (public). Routed to the right inbox by topic. */
export function sendContactMessage(input: ContactMessage): Promise<ContactResult> {
  return submitPublic("contact", "/contact", "contact-messages", "msg", input, "received");
}

// ── Careers talent network ──────────────────────────────────────────────────

export const TALENT_TEAMS = [
  { id: "engineering", label: "Engineering" },
  { id: "design", label: "Product & design" },
  { id: "community", label: "Community & trust" },
  { id: "growth", label: "Growth & partnerships" },
  { id: "operations", label: "Operations & support" },
] as const;

export type TalentTeam = (typeof TALENT_TEAMS)[number]["id"];

export interface TalentProfile {
  name: string;
  email: string;
  team: TalentTeam;
  city: string; // e.g. "Lagos"
  link?: string; // LinkedIn / portfolio / GitHub
  note?: string; // ≤500
}

export interface TalentResult {
  id: string;
  status: "joined";
}

/** planned: POST /careers/talent-network (public). */
export function joinTalentNetwork(input: TalentProfile): Promise<TalentResult> {
  return submitPublic("careers", "/careers/talent-network", "talent-network", "talent", input, "joined");
}

// ── Shared ──────────────────────────────────────────────────────────────────

async function submitPublic<S extends string>(
  endpoint: EndpointKey,
  path: string,
  storeKey: string,
  idPrefix: string,
  input: object,
  status: S,
): Promise<{ id: string; status: S }> {
  if (isLive(endpoint)) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(FRIENDLY_MESSAGES.network, 0, "network");
    }
    if (!res.ok) throw new ApiError(FRIENDLY_MESSAGES.server, res.status, res.status >= 500 ? "server" : "client");
    return res.json();
  }
  await latency(600);
  const all = load<object[]>(storeKey, () => []);
  const id = mockId(idPrefix);
  save(storeKey, [...all, { ...input, id, at: new Date().toISOString() }]);
  return { id, status };
}
