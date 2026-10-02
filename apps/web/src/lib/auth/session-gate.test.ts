import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionVerdict, staffVerdict } from "./session-gate";

const apiAnswers = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
const apiIsDown = () => vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
const api = () => vi.mocked(globalThis.fetch);
// Verdicts are remembered per cookie for the life of the module: every test uses its own.
let n = 0;
const cookie = () => `cookie-${++n}`;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sessionVerdict", () => {
  it("asks the API with the cookie as the bearer credential", async () => {
    apiAnswers(204);
    const c = cookie();
    expect(await sessionVerdict(c)).toBe("live");
    const [url, init] = api().mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/session$/);
    expect(init).toMatchObject({ headers: { Authorization: `Bearer ${c}` }, cache: "no-store" });
  });

  it("remembers 'live' for a minute, then asks again: the longest a revoked session keeps its pages", async () => {
    const c = cookie();
    apiAnswers(204);
    await sessionVerdict(c);
    apiAnswers(401); // revoked meanwhile
    vi.advanceTimersByTime(59_000);
    expect(await sessionVerdict(c)).toBe("live");
    expect(api()).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(await sessionVerdict(c)).toBe("revoked");
  });

  it("never remembers 'revoked'", async () => {
    const c = cookie();
    apiAnswers(401);
    expect(await sessionVerdict(c)).toBe("revoked");
    expect(await sessionVerdict(c)).toBe("revoked");
    expect(api()).toHaveBeenCalledTimes(2);
  });

  it("an unreachable, failing or rate-limiting API is 'unknown' (not 'revoked'), remembered only briefly", async () => {
    for (const fail of [apiIsDown, () => apiAnswers(500), () => apiAnswers(429)]) {
      const c = cookie();
      fail();
      expect(await sessionVerdict(c)).toBe("unknown");
      expect(await sessionVerdict(c)).toBe("unknown");
      expect(api()).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(11_000);
      apiAnswers(401);
      expect(await sessionVerdict(c)).toBe("revoked");
    }
  });

  it("simultaneous requests for one session share a single API call", async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (answer = r))));
    const c = cookie();
    const all = Promise.all([sessionVerdict(c), sessionVerdict(c), sessionVerdict(c)]);
    await vi.waitFor(() => expect(api()).toHaveBeenCalledTimes(1));
    answer(new Response(null, { status: 204 }));
    expect(await all).toEqual(["live", "live", "live"]);
    expect(api()).toHaveBeenCalledTimes(1);
  });

  it("keeps each session's verdict to itself", async () => {
    const [mine, theirs] = [cookie(), cookie()];
    apiAnswers(204);
    await sessionVerdict(mine);
    apiAnswers(401);
    expect(await sessionVerdict(theirs)).toBe("revoked");
    expect(await sessionVerdict(mine)).toBe("live");
  });
});

describe("staffVerdict", () => {
  it("maps the API's answer and remembers only 'staff'", async () => {
    const cases: [number, string][] = [[403, "not_staff"], [401, "expired"], [500, "unknown"]];
    for (const [status, verdict] of cases) {
      const c = cookie();
      apiAnswers(status);
      expect(await staffVerdict(c)).toBe(verdict);
      await staffVerdict(c);
      expect(api()).toHaveBeenCalledTimes(2);
    }
    const c = cookie();
    apiAnswers(204);
    expect(await staffVerdict(c)).toBe("staff");
    expect(await staffVerdict(c)).toBe("staff");
    expect(api()).toHaveBeenCalledTimes(1);
    expect(String(api().mock.calls[0]![0])).toMatch(/\/auth\/session\/staff$/);
  });

  it("is remembered separately from the session check for the same cookie", async () => {
    const c = cookie();
    apiAnswers(204);
    await sessionVerdict(c);
    apiAnswers(403);
    expect(await staffVerdict(c)).toBe("not_staff");
  });
});
