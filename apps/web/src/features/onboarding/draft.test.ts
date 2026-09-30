import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllOnboardingDrafts,
  clearOnboardingDraft,
  readOnboardingDraft,
  saveOnboardingDraft,
} from "./draft";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const draft = { name: "Ada", address: "14 Admiralty Way, Lekki", coords: { lat: 6.44, lng: 3.47 }, step: 2 };

describe("onboarding drafts", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("round-trips a draft for its own account", () => {
    saveOnboardingDraft("alice", draft);
    expect(readOnboardingDraft("alice")).toEqual(draft);
  });

  // Regression: drafts were stored under one shared key, so the next person
  // to sign in on the device saw the previous user's name and home address.
  it("never shows one account's draft to another", () => {
    saveOnboardingDraft("alice", draft);
    expect(readOnboardingDraft("bob")).toBeNull();
    clearOnboardingDraft("bob");
    expect(readOnboardingDraft("alice")).toEqual(draft);
  });

  it("clears every draft on sign-out, including the legacy shared key", () => {
    saveOnboardingDraft("alice", draft);
    saveOnboardingDraft("bob", { ...draft, name: "Bola" });
    localStorage.setItem("myhoodora:onboarding-draft", JSON.stringify(draft));
    localStorage.setItem("myhoodora:onboarding-skipped", "alice");
    clearAllOnboardingDrafts();
    expect(readOnboardingDraft("alice")).toBeNull();
    expect(readOnboardingDraft("bob")).toBeNull();
    expect(localStorage.getItem("myhoodora:onboarding-draft")).toBeNull();
    // "Skip for now" is a preference, not personal data — it survives.
    expect(localStorage.getItem("myhoodora:onboarding-skipped")).toBe("alice");
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => saveOnboardingDraft("alice", draft)).not.toThrow();
    expect(readOnboardingDraft("alice")).toBeNull();
    expect(() => clearAllOnboardingDrafts()).not.toThrow();
  });
});
