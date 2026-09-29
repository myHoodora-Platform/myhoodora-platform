import { ApiError, FRIENDLY_MESSAGES } from "./client";
import { API_BASE_URL, isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";

export const INSTITUTION_TYPES = [
  { id: "primary", label: "Primary school" },
  { id: "secondary", label: "Secondary school" },
  { id: "university", label: "University / polytechnic / college" },
  { id: "online", label: "Online course platform" },
  { id: "corporate", label: "Company training / L&D" },
  { id: "other", label: "Something else" },
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number]["id"];

export interface AiPilotRequest {
  name: string;
  email: string;
  institution: string;
  institutionType: InstitutionType;
  role?: string; // e.g. "Lecturer, Biochemistry"
  subjects?: string; // what they'd like to convert first
}

export interface AiPilotResult {
  id: string;
  status: "waitlisted";
}

/**
 * planned: POST /ai/pilot-requests (public; no account needed).
 * Adds a school / lecturer to the myHoodora AI pilot waitlist.
 */
export async function submitAiPilotRequest(input: AiPilotRequest): Promise<AiPilotResult> {
  if (isLive("ai.pilot")) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/ai/pilot-requests`, {
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
  const all = load<(AiPilotRequest & { id: string; at: string })[]>("ai-pilot-requests", () => []);
  const id = mockId("aipilot");
  save("ai-pilot-requests", [...all, { ...input, id, at: new Date().toISOString() }]);
  return { id, status: "waitlisted" };
}
