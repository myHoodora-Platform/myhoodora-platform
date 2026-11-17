import { beforeEach, describe, expect, it, vi } from "vitest";
import { normaliseInviteCode, withInviteRef } from "@myhoodora/api-contract/invites";
import { clearSavedInvite, myInviteCode, readSavedInvite, rememberInviteRef, rememberMyInviteCode } from "./invite-ref";

const DAY = 24 * 60 * 60 * 1000;

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

describe("the invite code someone arrived with", () => {
  beforeEach(() => vi.stubGlobal("window", { localStorage: memoryStorage() }));

  it("keeps the first code and how it came, for 30 days", () => {
    rememberInviteRef("ada-7k", "qr", { now: 0 });
    rememberInviteRef("TUNDE9", "post", { now: DAY });
    expect(readSavedInvite(2 * DAY)).toEqual({ code: "ADA7K", via: "qr", at: 0 });
    expect(readSavedInvite(31 * DAY)).toBeNull();
    rememberInviteRef("TUNDE9", "post", { now: 31 * DAY });
    expect(readSavedInvite(31 * DAY)?.code).toBe("TUNDE9");
  });

  it("a code typed at sign-up replaces one a link brought; junk is ignored", () => {
    rememberInviteRef("ADA7K", "link", { now: 0 });
    rememberInviteRef("<script>", "code", { now: 0, replace: true });
    expect(readSavedInvite(0)?.code).toBe("ADA7K");
    rememberInviteRef("bisi22", "code", { now: 0, replace: true });
    expect(readSavedInvite(0)).toMatchObject({ code: "BISI22", via: "code" });
    clearSavedInvite();
    expect(readSavedInvite(0)).toBeNull();
  });

  it("remembers their own code for the links they share", () => {
    expect(myInviteCode()).toBeNull();
    rememberMyInviteCode("ADA7K");
    expect(myInviteCode()).toBe("ADA7K");
  });

  it("survives blocked storage", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    rememberInviteRef("ADA7K", "link");
    expect(readSavedInvite()).toBeNull();
    expect(myInviteCode()).toBeNull();
  });
});

describe("links carry the sharer's code", () => {
  it("adds or replaces ref, keeping the rest", () => {
    expect(withInviteRef("/p/abc", "ADA7K")).toBe("/p/abc?ref=ADA7K");
    expect(withInviteRef("/for-sale/1?tab=photos#top", "ADA7K")).toBe("/for-sale/1?tab=photos&ref=ADA7K#top");
    expect(withInviteRef("/p/abc?ref=OLD11", "ADA7K")).toBe("/p/abc?ref=ADA7K");
    expect(withInviteRef("/p/abc", null)).toBe("/p/abc");
  });

  it("reads codes however they were typed", () => {
    expect(normaliseInviteCode(" ada-7k ")).toBe("ADA7K");
    expect(normaliseInviteCode("ab")).toBeNull();
    expect(normaliseInviteCode(undefined)).toBeNull();
  });
});
