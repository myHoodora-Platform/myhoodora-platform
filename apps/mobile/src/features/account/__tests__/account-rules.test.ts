import { DEFAULT_PREFERENCES } from "@myhoodora/api-contract/settings";
import { canChangeEmail, followable, profileErrors, reasonProblem } from "../account-rules";
import { mergePrefs } from "../use-preferences";

jest.mock("@/core/auth/auth-provider", () => ({}));
jest.mock("@/core/api/client", () => ({ apiFetch: jest.fn() }));
jest.mock("@/core/media/media", () => ({}));
jest.mock("@/shared/ui/toast", () => ({ useToast: () => jest.fn() }));

describe("preferences, shown before the API answers", () => {
  it("changes one channel of one category and keeps the rest", () => {
    const next = mergePrefs(DEFAULT_PREFERENCES, { notifications: { events: { push: true } } });
    expect(next.notifications.events).toEqual({ push: true, email: false });
    expect(next.notifications.messages).toEqual(DEFAULT_PREFERENCES.notifications.messages);
  });

  it("changes a privacy choice and the digest", () => {
    const next = mergePrefs(DEFAULT_PREFERENCES, { privacy: { messaging: "nobody" }, digest: "off" });
    expect(next.privacy).toEqual({ ...DEFAULT_PREFERENCES.privacy, messaging: "nobody" });
    expect(next.digest).toBe("off");
  });
});

describe("profile rules", () => {
  it("uses the API's limits for a name and a bio", () => {
    expect(profileErrors("Ada Okafor", "Keen gardener")).toBeNull();
    expect(profileErrors("A", "")).toEqual({ name: "Your name needs at least 2 characters." });
    expect(profileErrors("Ada", "x".repeat(161))).toEqual({ bio: "Keep it to 160 characters." });
  });
});

describe("changing email", () => {
  it("only while unconfirmed, and only for a password sign-in", () => {
    expect(canChangeEmail({ emailVerified: false }, ["password"])).toBe(true);
    expect(canChangeEmail({ emailVerified: true }, ["password"])).toBe(false);
    expect(canChangeEmail({ emailVerified: false }, ["google.com"])).toBe(false);
    expect(canChangeEmail(null, ["password"])).toBe(false);
  });
});

describe("neighbourhood requests", () => {
  const hoods = [
    { _id: "1", name: "Yaba", city: "Lagos" },
    { _id: "2", name: "Bodija", city: "Ibadan" },
    { _id: "3", name: "Ikeja", city: "Lagos" },
    { _id: "4", name: "Lekki Phase 1", city: "Lagos" },
  ];

  it("offers only what they don't have or haven't asked for, by city then name", () => {
    expect(followable(hoods, new Set(["4"]), "")).toEqual([
      { city: "Ibadan", hoods: [hoods[1]] },
      { city: "Lagos", hoods: [hoods[2], hoods[0]] },
    ]);
  });

  it("puts your own city first", () => {
    expect(followable(hoods, new Set(), "", "Lagos").map((g) => g.city)).toEqual(["Lagos", "Ibadan"]);
  });

  it("searches names and cities", () => {
    expect(followable(hoods, new Set(), "ibad").map((g) => g.city)).toEqual(["Ibadan"]);
    expect(followable(hoods, new Set(), "yab")[0]!.hoods.map((h) => h.name)).toEqual(["Yaba"]);
  });

  it("asks for a real reason, within the API's bounds", () => {
    expect(reasonProblem("work")).toMatch(/at least 10/);
    expect(reasonProblem("I work at the hospital there.")).toBeNull();
    expect(reasonProblem("x".repeat(501))).toMatch(/500/);
  });
});
