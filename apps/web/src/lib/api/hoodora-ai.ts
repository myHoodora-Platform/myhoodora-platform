import { publicPost } from "./client";
import { isLive } from "./config";
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
 * live: POST /ai/pilot-requests (public; no account needed).
 * Adds a school / lecturer to the myHoodora AI pilot waitlist.
 */
export async function submitAiPilotRequest(input: AiPilotRequest): Promise<AiPilotResult> {
  if (isLive("ai.pilot")) {
    return publicPost<AiPilotResult>("/ai/pilot-requests", input);
  }
  await latency(600);
  const all = load<(AiPilotRequest & { id: string; at: string })[]>("ai-pilot-requests", () => []);
  const id = mockId("aipilot");
  save("ai-pilot-requests", [...all, { ...input, id, at: new Date().toISOString() }]);
  return { id, status: "waitlisted" };
}
