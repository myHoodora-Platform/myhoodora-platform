import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountConfirmed,
  forgetAccountConfirmed,
  rememberAccountConfirmed,
} from "./confirmed";

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe("confirming the account before continuing to myHoodora AI", () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  it("asks until this account confirms this sign-in", () => {
    expect(accountConfirmed("s1", "u1")).toBe(false);
    rememberAccountConfirmed("s1", "u1", 1_000);
    expect(accountConfirmed("s1", "u1", 2_000)).toBe(true);
  });

  it("asks again for another sign-in, another account, or after 15 minutes", () => {
    rememberAccountConfirmed("s1", "u1", 0);
    expect(accountConfirmed("s2", "u1", 1)).toBe(false);
    expect(accountConfirmed("s1", "u2", 1)).toBe(false);
    expect(accountConfirmed("s1", "u1", 15 * 60_000 + 1)).toBe(false);
  });

  it("never skips without a state, and forgets on request", () => {
    rememberAccountConfirmed(undefined, "u1");
    expect(accountConfirmed(undefined, "u1")).toBe(false);
    rememberAccountConfirmed("s1", "u1");
    forgetAccountConfirmed();
    expect(accountConfirmed("s1", "u1")).toBe(false);
  });
});
