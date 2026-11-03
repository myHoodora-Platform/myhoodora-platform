import { describe, expect, it } from "vitest";
import { clearMemoryCaches, createMemoryCache } from "./memory-cache";

describe("memory cache", () => {
  it("returns what was stored", () => {
    const c = createMemoryCache<number>();
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("drops the oldest entry past its limit", () => {
    const c = createMemoryCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 3); // rewriting makes it the newest
    c.set("c", 4);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(3);
    expect(c.get("c")).toBe(4);
  });

  it("clears every cache on sign-out", () => {
    const x = createMemoryCache<string>();
    const y = createMemoryCache<string>();
    x.set("k", "chat");
    y.set("k", "support");
    clearMemoryCaches();
    expect(x.get("k")).toBeUndefined();
    expect(y.get("k")).toBeUndefined();
  });
});
