import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The Admin SDK's verifiers are the only stubs: "id:<uid>[:<signIn>]" is a good ID token,
// "sc:<uid>:<issuedAgoSeconds>[:<signIn>]" a good 7-day session cookie. Anything else is refused.
// <signIn> stands for auth_time: which sign-in the token belongs to (1 unless given).
const WEEK = 7 * 24 * 60 * 60;
const now = () => Math.floor(Date.now() / 1000);
const refuse = () => {
  throw Object.assign(new Error("bad"), { code: "auth/argument-error" });
};
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: () => ({ name: "session-verifier" }) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (t: string) => {
      const [kind, uid, signIn] = t.split(":");
      return kind === "id" && uid ? { uid, auth_time: Number(signIn ?? 1), iat: now() - 60, exp: now() + 3540 } : refuse();
    },
    verifySessionCookie: async (c: string) => {
      const [kind, uid, age, signIn] = c.split(":");
      return kind === "sc" && uid ? { uid, auth_time: Number(signIn ?? 1), iat: now() - Number(age), exp: now() - Number(age) + WEEK } : refuse();
    },
  }),
}));
// These tests cover the real (API-backed) path; vitest otherwise runs in mock mode.
const config = vi.hoisted(() => ({ API_BASE_URL: "http://api.test/api", USE_MOCKS: false }));
vi.mock("@/lib/api/config", () => config);

const { POST: session } = await import("./session/route");
const { POST: logout } = await import("./logout/route");

function post(path: string, body: unknown, opts: { cookie?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...(opts.cookie ? { cookie: `__session=${opts.cookie}` } : {}),
      ...opts.headers,
    },
  });
}
const setCookie = (res: Response) => res.headers.get("set-cookie");
const apiMints = (cookie = "sc:ada:0") =>
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ sessionCookie: cookie, expiresIn: WEEK })));
const api = () => vi.mocked(globalThis.fetch);

beforeEach(() => apiMints());
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/auth/session", () => {
  it("exchanges an ID token for an HttpOnly session cookie minted by the API", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }));
    expect(res.status).toBe(200);
    expect(api()).toHaveBeenCalledWith("http://api.test/api/auth/session", expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer id:ada" } }));
    const cookie = setCookie(res)!;
    expect(cookie).toContain("__session=sc%3Aada%3A0");
    expect(cookie).toContain(`Max-Age=${WEEK}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("Domain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The cookie value is never in the body, where page script could read it.
    expect(await res.text()).not.toContain("sc:ada");
  });

  it("keeps a cookie that is already theirs and fresh, without calling the API", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { cookie: "sc:ada:3600" }));
    expect(res.status).toBe(200);
    expect(api()).not.toHaveBeenCalled();
    expect(setCookie(res)).toBeNull();
  });

  it("renews a cookie past half its life", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { cookie: `sc:ada:${WEEK / 2 + 60}` }));
    expect(api()).toHaveBeenCalledTimes(1);
    expect(setCookie(res)).toContain("__session=sc%3Aada%3A0");
  });

  it("a new sign-in gets a new cookie, even over a fresh one from an earlier sign-in", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada:2" }, { cookie: "sc:ada:60:1" }));
    expect(api()).toHaveBeenCalledTimes(1);
    expect(setCookie(res)).toContain("__session=sc%3Aada%3A0");
  });

  it("replaces another account's cookie", async () => {
    apiMints("sc:tunde:0");
    const res = await session(post("/api/auth/session", { idToken: "id:tunde" }, { cookie: "sc:ada:60" }));
    expect(setCookie(res)).toContain("__session=sc%3Atunde%3A0");
  });

  it("replaces an expired, forged or old-format (ID token) cookie", async () => {
    for (const cookie of [`sc:ada:${WEEK + 5}`, "garbage", "id:ada"]) {
      const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { cookie }));
      expect(setCookie(res)).toContain("__session=sc%3Aada%3A0");
    }
  });

  it("refuses a bad ID token (401) and clears the cookie, without calling the API", async () => {
    for (const idToken of ["garbage", "sc:ada:0"]) {
      const res = await session(post("/api/auth/session", { idToken }, { cookie: "sc:ada:60" }));
      expect(res.status).toBe(401);
      expect(setCookie(res)).toMatch(/__session=;.*Max-Age=0/);
    }
    expect(api()).not.toHaveBeenCalled();
  });

  it("the API refusing the token (revoked, disabled) is a 401 that clears the cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { cookie: `sc:ada:${WEEK - 60}` }));
    expect(res.status).toBe(401);
    expect(setCookie(res)).toMatch(/__session=;.*Max-Age=0/);
  });

  it("API down: 503 with no cookie, but someone's own still-valid cookie is kept (200)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const none = await session(post("/api/auth/session", { idToken: "id:ada" }));
    expect(none.status).toBe(503);
    const own = await session(post("/api/auth/session", { idToken: "id:ada" }, { cookie: `sc:ada:${WEEK - 60}` }));
    expect(own.status).toBe(200);
    expect(setCookie(own)).toBeNull();
    // Never leave a different account's session in place.
    const other = await session(post("/api/auth/session", { idToken: "id:tunde" }, { cookie: "sc:ada:60" }));
    expect(other.status).toBe(503);
    expect(setCookie(other)).toMatch(/__session=;.*Max-Age=0/);
  });

  it("a malformed API answer is treated as unavailable, never stored", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ nope: true })));
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }));
    expect(res.status).toBe(503);
  });

  it("rejects missing or malformed bodies (400)", async () => {
    for (const body of [{}, { idToken: 42 }, { idToken: "" }, "not json"]) {
      expect((await session(post("/api/auth/session", body))).status).toBe(400);
    }
    expect(api()).not.toHaveBeenCalled();
  });

  it("refuses cross-site requests (login CSRF): 403, no cookie", async () => {
    const attempts: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "", origin: "https://evil.example", host: "localhost:3000" },
      { "sec-fetch-site": "" }, // neither header: not a browser we can vouch for
    ];
    for (const headers of attempts) {
      const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { headers }));
      expect(res.status).toBe(403);
      expect(setCookie(res)).toBeNull();
    }
    expect(api()).not.toHaveBeenCalled();
  });

  it("accepts a same-origin request from a browser without Fetch Metadata (Origin matches Host)", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { headers: { "sec-fetch-site": "", origin: "http://localhost:3000", host: "localhost:3000" } }));
    expect(res.status).toBe(200);
  });
});

describe("mock mode (no API)", () => {
  beforeEach(() => void (config.USE_MOCKS = true));
  afterEach(() => void (config.USE_MOCKS = false));

  it("has no server session: answers ok, sets no cookie, calls nothing", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }));
    expect(res.status).toBe(200);
    expect(setCookie(res)).toBeNull();
    expect(api()).not.toHaveBeenCalled();
  });

  it("still refuses cross-site requests", async () => {
    const res = await session(post("/api/auth/session", { idToken: "id:ada" }, { headers: { "sec-fetch-site": "cross-site" } }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie with the same attributes, and is safe to repeat or call signed out", async () => {
    for (const cookie of ["sc:ada:60", undefined]) {
      const res = await logout(post("/api/auth/logout", {}, { cookie }));
      expect(res.status).toBe(200);
      expect(setCookie(res)).toMatch(/__session=;.*Path=\/.*Max-Age=0.*HttpOnly/);
    }
    expect(api()).not.toHaveBeenCalled(); // this browser only: nothing is revoked
  });

  it("refuses cross-site requests (forced logout)", async () => {
    const res = await logout(post("/api/auth/logout", {}, { cookie: "sc:ada:60", headers: { "sec-fetch-site": "cross-site" } }));
    expect(res.status).toBe(403);
    expect(setCookie(res)).toBeNull();
  });
});
