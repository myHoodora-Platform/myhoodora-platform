import { describe, expect, it } from "vitest";
import { load } from "./mock/store";
import { isContactTopic, joinTalentNetwork, sendContactMessage } from "./company";

describe("company forms (mock)", () => {
  it("recognises valid contact topics only", () => {
    expect(isContactTopic("press")).toBe(true);
    expect(isContactTopic("pizza")).toBe(false);
    expect(isContactTopic(undefined)).toBe(false);
  });

  it("stores contact messages and talent profiles", async () => {
    const msg = await sendContactMessage({
      topic: "press",
      name: "Ngozi Okafor",
      email: "ngozi@example.com",
      message: "I'd like to interview the team about neighbourhood safety in Lagos.",
      organisation: "Lagos Weekly",
    });
    expect(msg.status).toBe("received");
    expect(load<{ id: string }[]>("contact-messages", () => []).some((m) => m.id === msg.id)).toBe(true);

    const talent = await joinTalentNetwork({ name: "Tunde Bello", email: "tunde@example.com", team: "engineering", city: "Ibadan" });
    expect(talent.status).toBe("joined");
    expect(load<{ id: string }[]>("talent-network", () => []).some((t) => t.id === talent.id)).toBe(true);
  });
});
