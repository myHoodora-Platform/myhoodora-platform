import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSharedVisit, inAppBrowser, openInAppHref, readInviteRef, readSharedVisit, rememberSharedVisit } from "./shared-visit";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A156E) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1";
const INSTAGRAM = `${ANDROID} Instagram 350.0.0.0`;
const DAY = 24 * 60 * 60 * 1000;

/** The tests run in Node: a small in-memory localStorage stands in for the browser's. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("remembering the shared post", () => {
  let localStorage: Storage;
  beforeEach(() => {
    localStorage = memoryStorage();
    vi.stubGlobal("window", { localStorage });
  });

  it("keeps it a week, then forgets", () => {
    rememberSharedVisit({ postId: "a".repeat(24), hoodName: "Lekki Phase 1" }, 1_000);
    expect(readSharedVisit(1_000 + DAY)).toMatchObject({ postId: "a".repeat(24), hoodName: "Lekki Phase 1" });
    expect(readSharedVisit(1_000 + 8 * DAY)).toBeNull();
    clearSharedVisit();
    expect(readSharedVisit(1_000)).toBeNull();
  });

  it("keeps the first invite code for 30 days; junk codes are ignored", () => {
    rememberSharedVisit({ postId: "x", ref: "ada7k" }, 0);
    rememberSharedVisit({ postId: "x", ref: "OTHER1" }, DAY);
    expect(readInviteRef(DAY)).toBe("ADA7K");
    rememberSharedVisit({ postId: "x", ref: "LATER9" }, 31 * DAY);
    expect(readInviteRef(31 * DAY)).toBe("LATER9");
    rememberSharedVisit({ postId: "x", ref: "<script>" }, 32 * DAY);
    expect(readInviteRef(32 * DAY)).toBe("LATER9");
  });

  it("survives broken storage contents", () => {
    localStorage.setItem("mh-shared-from", "{not json");
    expect(readSharedVisit()).toBeNull();
  });
});

describe("opening in the app", () => {
  it("uses an intent link with the Play Store as fallback on Android", () => {
    const href = openInAppHref("/p/abc", ANDROID)!;
    expect(href).toMatch(/^intent:\/\/p\/abc#Intent;scheme=myhoodora;package=com\.myhoodora\.app;S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com/);
  });

  it("offers nothing on iPhone or desktop yet", () => {
    expect(openInAppHref("p/abc", IPHONE)).toBeNull();
    expect(openInAppHref("p/abc", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBeNull();
  });

  it("spots in-app browsers", () => {
    expect(inAppBrowser(INSTAGRAM)).toBe(true);
    expect(inAppBrowser(`${IPHONE} [FBAN/FBIOS;FBAV/450.0]`)).toBe(true);
    expect(inAppBrowser(ANDROID)).toBe(false);
  });
});
