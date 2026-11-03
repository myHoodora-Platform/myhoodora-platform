import { describe, expect, it } from "vitest";
import { load } from "./mock/store";
import { submitAiPilotRequest } from "./hoodora-ai";

describe("myHoodora AI pilot waitlist (mock)", () => {
  it("waitlists a request and keeps it in the mock store", async () => {
    const res = await submitAiPilotRequest({
      name: "Dr. Funmi Adeyemi",
      email: "funmi@example.edu.ng",
      institution: "University of Ibadan",
      institutionType: "university",
      subjects: "BCH 201: enzymes",
    });
    expect(res.status).toBe("waitlisted");
    const saved = load<{ id: string; institution: string }[]>("ai-pilot-requests", () => []);
    expect(saved.find((r) => r.id === res.id)?.institution).toBe("University of Ibadan");
  });
});
