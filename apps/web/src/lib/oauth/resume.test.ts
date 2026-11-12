import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberOAuthResume, takeOAuthResume } from "./resume";

/** sessionStorage for the node test environment. */
function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe("returning to “Continue to myHoodora AI” after a detour", () => {
  const authorize = "/oauth/authorize?client_id=myhoodora-ai&state=abc";
  let store: Map<string, string>;
  beforeEach(() => (store = stubStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("remembers the authorise page and gives it back once", () => {
    rememberOAuthResume(authorize, 1_000);
    expect(takeOAuthResume(2_000)).toBe(authorize);
    expect(takeOAuthResume(3_000)).toBeNull();
  });

  it("forgets it after 15 minutes", () => {
    rememberOAuthResume(authorize, 0);
    expect(takeOAuthResume(15 * 60_000 + 1)).toBeNull();
  });

  it("only ever remembers the authorise page: never somewhere else", () => {
    for (const elsewhere of ["/news-feed", "https://evil.test/oauth/authorize", "//evil.test", "/oauth/authorized"]) {
      rememberOAuthResume(elsewhere, 0);
      expect(takeOAuthResume(1)).toBeNull();
    }
    // Planted directly in storage, it's still refused.
    store.set("myhoodora.oauth.resume", JSON.stringify({ path: "https://evil.test", at: 0 }));
    expect(takeOAuthResume(1)).toBeNull();
    store.set("myhoodora.oauth.resume", "not json");
    expect(takeOAuthResume(1)).toBeNull();
  });

  it("does nothing when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    });
    expect(() => rememberOAuthResume(authorize)).not.toThrow();
    expect(takeOAuthResume()).toBeNull();
  });
});
