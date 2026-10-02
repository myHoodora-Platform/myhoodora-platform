import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { clearMemoryCaches } from "./memory-cache";
import { createSharedLoader } from "./shared-loader";

const ada = { uid: "ada" } as User;
const tunde = { uid: "tunde" } as User;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSharedLoader", () => {
  it("shares one request between everyone asking at the same moment", async () => {
    let release!: (n: number) => void;
    const fetcher = vi.fn(() => new Promise<number>((r) => (release = r)));
    const loader = createSharedLoader(fetcher);
    const all = Promise.all([loader.load(ada), loader.load(ada), loader.load(ada)]);
    release(3);
    expect(await all).toEqual([3, 3, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("remembers the answer: readers paint it at once, and a just-fetched one isn't fetched again", async () => {
    const fetcher = vi.fn(async () => 7);
    const loader = createSharedLoader(fetcher, 5_000);
    expect(loader.peek("ada")).toBeUndefined();
    await loader.load(ada);
    expect(loader.peek("ada")).toBe(7);
    await loader.load(ada);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6_000);
    await loader.load(ada);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("`force` always asks again (a live event said it changed)", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const loader = createSharedLoader(fetcher);
    await loader.load(ada);
    expect(await loader.load(ada, { force: true })).toBe(2);
    expect(loader.peek("ada")).toBe(2);
  });

  it("keeps each person's answer to themselves, and forgets everything on sign-out", async () => {
    const loader = createSharedLoader(async (user: User) => (user.uid === "ada" ? 1 : 9));
    expect(await Promise.all([loader.load(ada), loader.load(tunde)])).toEqual([1, 9]);
    expect(loader.peek("tunde")).toBe(9);
    clearMemoryCaches();
    expect(loader.peek("ada")).toBeUndefined();
  });

  it("doesn't remember a failure", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(4);
    const loader = createSharedLoader(fetcher);
    await expect(loader.load(ada)).rejects.toThrow("offline");
    expect(loader.peek("ada")).toBeUndefined();
    expect(await loader.load(ada)).toBe(4);
  });

  it("`set` replaces the remembered answer (optimistic updates)", async () => {
    const loader = createSharedLoader(async () => 5);
    await loader.load(ada);
    loader.set("ada", 0);
    expect(loader.peek("ada")).toBe(0);
  });
});
