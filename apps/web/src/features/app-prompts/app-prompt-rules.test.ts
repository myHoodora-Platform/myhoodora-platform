import { beforeEach, describe, expect, it, vi } from "vitest";
import { androidOpenHref, appPathFor, bannerClosedRecently, closeBanner, closeSheet, countVisit, deviceOf, sheetClosedRecently } from "./app-prompt-rules";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => void m.delete(k), setItem: (k, v) => void m.set(k, String(v)) };
}
const DAY = 86_400_000;

describe("app prompts", () => {
  beforeEach(() => vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() }));

  it("knows the phone and opens the same page in the app (Play Store with the invite code otherwise)", () => {
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1)")).toBe("ios");
    expect(deviceOf("Mozilla/5.0 (Macintosh)")).toBe("other");
    expect(appPathFor("/p/6afc34d22644cd9c608d34dc?x=1")).toBe("p/6afc34d22644cd9c608d34dc");
    expect(appPathFor("/settings/account")).toBe("news-feed");
    const href = androidOpenHref("/p/abc", "ADA7K");
    expect(href).toMatch(/^intent:\/\/p\/abc\?ref=ADA7K#Intent;scheme=myhoodora;package=com\.myhoodora\.app;S\.browser_fallback_url=/);
    expect(decodeURIComponent(href)).toContain("referrer=ref%3DADA7K");
  });

  it("a closed banner stays away two weeks; the sheet as long as admins set", () => {
    closeBanner(0);
    expect(bannerClosedRecently(13 * DAY)).toBe(true);
    expect(bannerClosedRecently(15 * DAY)).toBe(false);
    closeSheet(0);
    expect(sheetClosedRecently(7, 6 * DAY)).toBe(true);
    expect(sheetClosedRecently(7, 8 * DAY)).toBe(false);
  });

  it("counts visits, not page views", () => {
    expect(countVisit()).toBe(1);
    expect(countVisit()).toBe(1);
  });
});
