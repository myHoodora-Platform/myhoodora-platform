import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The Admin SDK's verifier is the only stub: "sc:<uid>" is a good session cookie, anything else is refused.
// `google.keysDown` makes Google's signing keys unfetchable, failing the way the SDK reports it.
const google = vi.hoisted(() => ({ keysDown: false }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: () => ({ name: "session-verifier" }) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifySessionCookie: async (c: string) => {
      if (google.keysDown) throw Object.assign(new Error("Error while making request: connect ETIMEDOUT. Error code: ETIMEDOUT"), { code: "auth/argument-error" });
      const [kind, uid] = c.split(":");
      if (kind !== "sc" || !uid) throw Object.assign(new Error("bad"), { code: "auth/argument-error" });
      return { uid };
    },
  }),
}));
// These tests cover the real path; vitest otherwise runs in mock mode, where there is no server session.
vi.mock("@/lib/api/config", () => ({ API_BASE_URL: "http://api.test/api", USE_MOCKS: false }));

const { GET: geocode } = await import("./geocode/route");
const { GET: reverseGeocode } = await import("./reverse-geocode/route");
const { GET: ipLocation } = await import("./ip-location/route");
const { resetLookupLimits } = await import("@/lib/auth/lookup-guard");

const get = (path: string, opts: { as?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { ...(opts.as ? { cookie: `__session=${opts.as}` } : {}), ...opts.headers } });

const routes = [
  { name: "geocode", call: (o?: Parameters<typeof get>[1]) => geocode(get("/api/geocode?address=Admiralty%20Way%2C%20Lekki", o)) },
  { name: "reverse-geocode", call: (o?: Parameters<typeof get>[1]) => reverseGeocode(get("/api/reverse-geocode?lat=6.4478&lng=3.4746", o)) },
  { name: "ip-location", call: (o?: Parameters<typeof get>[1]) => ipLocation(get("/api/ip-location", { ...o, headers: { "x-forwarded-for": "102.89.1.1", ...o?.headers } })) },
] as const;

/** The third parties these routes spend quota with. */
const thirdParty = () => vi.mocked(globalThis.fetch);
const thirdPartyAnswers = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/search")) return Response.json([{ lat: "6.4478", lon: "3.4746" }]);
      if (url.includes("/reverse")) return Response.json({ display_name: "Admiralty Way, Lekki Phase 1, Lagos" });
      return Response.json({ status: "success", lat: 6.45, lon: 3.47, city: "Lagos", region: "LA", country: "Nigeria" });
    }),
  );

beforeEach(() => {
  process.env.GEOCODE_MAPS_CO_API_KEY = "test-key";
  resetLookupLimits();
  thirdPartyAnswers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  google.keysDown = false;
});

// Audit B14: the proxy doesn't cover /api/*, so these were open to anyone on the internet.
describe.each(routes)("GET /api/$name", ({ call }) => {
  it("refuses a visitor who isn't signed in (401) without spending any quota", async () => {
    for (const as of [undefined, "forged", "id:ada"]) {
      const res = await call({ as });
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(thirdParty()).not.toHaveBeenCalled();
  });

  it("answers a signed-in visitor", async () => {
    const res = await call({ as: "sc:ada" });
    expect(res.status).toBe(200);
    expect(thirdParty()).toHaveBeenCalled();
  });

  it("limits each person, and one person's lookups don't use up a neighbour's on the same address", async () => {
    for (let i = 0; i < 20; i++) expect((await call({ as: "sc:ada" })).status).toBe(200);
    const spent = thirdParty().mock.calls.length;
    const blocked = await call({ as: "sc:ada" });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(thirdParty().mock.calls.length).toBe(spent);
    // Same address (the test requests all come from one), different person.
    expect((await call({ as: "sc:bola" })).status).toBe(200);
  });

  it("the allowance comes back after a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < 20; i++) await call({ as: "sc:ada" });
      expect((await call({ as: "sc:ada" })).status).toBe(429);
      vi.setSystemTime(Date.now() + 61_000);
      expect((await call({ as: "sc:ada" })).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a third party that doesn't answer in time is a 504, not a hung request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }));
    expect((await call({ as: "sc:ada" })).status).toBe(504);
  });

  it("gives every third-party request a time limit", async () => {
    await call({ as: "sc:ada" });
    for (const [, init] of thirdParty().mock.calls) expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
  });

  it("when the session can't be checked (Google's keys unfetchable) it is 503: quota stays protected, nobody is told they're signed out", async () => {
    google.keysDown = true;
    expect((await call({ as: "sc:ada" })).status).toBe(503);
    expect(thirdParty()).not.toHaveBeenCalled();
  });
});

describe("input the routes pass on to third parties", () => {
  it("geocode: a missing or absurdly long address is refused before any lookup", async () => {
    expect((await geocode(get("/api/geocode", { as: "sc:ada" }))).status).toBe(400);
    expect((await geocode(get(`/api/geocode?address=${"a".repeat(201)}`, { as: "sc:ada" }))).status).toBe(400);
    expect(thirdParty()).not.toHaveBeenCalled();
  });

  it("reverse-geocode: missing, non-numeric or out-of-range coordinates are refused (a missing one is not 0)", async () => {
    for (const query of ["", "?lat=6.4", "?lng=3.4", "?lat=abc&lng=3.4", "?lat=91&lng=3.4", "?lat=6.4&lng=181"]) {
      expect((await reverseGeocode(get(`/api/reverse-geocode${query}`, { as: "sc:ada" }))).status).toBe(400);
    }
    expect(thirdParty()).not.toHaveBeenCalled();
  });

  it("ip-location: only a real IP address is ever put into the lookup URL", async () => {
    for (const forwarded of ["8.8.8.8/../admin?x=", "not-an-ip", "127.0.0.1", "::1", ""]) {
      const res = await ipLocation(get("/api/ip-location", { as: "sc:ada", headers: { "x-forwarded-for": forwarded } }));
      expect(res.status).toBe(404);
    }
    expect(thirdParty()).not.toHaveBeenCalled();
    await ipLocation(get("/api/ip-location", { as: "sc:ada", headers: { "x-forwarded-for": "102.89.1.1, 10.0.0.1" } }));
    expect(String(thirdParty().mock.calls[0]![0])).toBe("http://ip-api.com/json/102.89.1.1?fields=status,lat,lon,city,region,country");
  });

  it("ip-location: the hosting platform's own answer is used without a lookup", async () => {
    const res = await ipLocation(get("/api/ip-location", { as: "sc:ada", headers: { "x-vercel-ip-latitude": "6.45", "x-vercel-ip-longitude": "3.39" } }));
    expect(await res.json()).toMatchObject({ lat: 6.45, lng: 3.39, source: "vercel" });
    expect(thirdParty()).not.toHaveBeenCalled();
  });
});
