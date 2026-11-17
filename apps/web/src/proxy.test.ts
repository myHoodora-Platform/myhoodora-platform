import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The two things the proxy asks about a cookie are the stubs: this server's own signature check,
// and the API's verdict on whether the session is still live.
const { VerifierUnavailableError, verifySessionCookie, sessionVerdict, staffVerdict, hoodoraAiStudioUrl } = vi.hoisted(() => ({
  VerifierUnavailableError: class VerifierUnavailableError extends Error {},
  verifySessionCookie: vi.fn(),
  sessionVerdict: vi.fn(),
  staffVerdict: vi.fn(),
  hoodoraAiStudioUrl: vi.fn(),
}));
vi.mock("@/lib/hoodora-ai", () => ({ hoodoraAiStudioUrl }));
vi.mock("@/lib/auth/session-cookie", () => ({
  SESSION_COOKIE: "__session",
  VerifierUnavailableError,
  verifySessionCookie,
  sessionCookieOptions: (maxAge: number) => ({ httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", maxAge }),
}));
vi.mock("@/lib/auth/session-gate", () => ({ sessionVerdict, staffVerdict }));
// These tests cover the real (API-backed) gate; vitest otherwise runs in mock mode, where there is none.
vi.mock("@/lib/api/config", () => ({ API_BASE_URL: "http://api.test/api", USE_MOCKS: false, isLive: () => true }));

const { proxy } = await import("./proxy");

const visit = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie: `__session=${cookie}` } : {} }));
const served = (res: Response) => res.headers.get("x-middleware-next") === "1";
const redirectedTo = (res: Response) => res.headers.get("location");
const cookieDropped = (res: Response) => /__session=;.*Max-Age=0/.test(res.headers.get("set-cookie") ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  verifySessionCookie.mockResolvedValue({ uid: "ada" });
  sessionVerdict.mockResolvedValue("live");
  staffVerdict.mockResolvedValue("staff");
  hoodoraAiStudioUrl.mockResolvedValue(null);
});

describe("the page gate", () => {
  it("serves a signed-in page to a genuine, live session", async () => {
    const res = await visit("/news-feed", "good");
    expect(served(res)).toBe(true);
    expect(cookieDropped(res)).toBe(false);
  });

  it("sends a visitor with no cookie to login, remembering where they were going", async () => {
    const res = await visit("/p/abc");
    expect(redirectedTo(res)).toBe("http://localhost:3000/login?next=%2Fp%2Fabc");
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("refuses and removes a forged or expired cookie, without asking the API", async () => {
    verifySessionCookie.mockResolvedValue(null);
    const res = await visit("/news-feed", "forged");
    expect(redirectedTo(res)).toBe("http://localhost:3000/login");
    expect(cookieDropped(res)).toBe(true);
    expect(sessionVerdict).not.toHaveBeenCalled();
  });

  it("refuses and removes a genuine cookie whose session the API says was revoked", async () => {
    sessionVerdict.mockResolvedValue("revoked");
    const res = await visit("/news-feed", "revoked");
    expect(redirectedTo(res)).toBe("http://localhost:3000/login");
    expect(cookieDropped(res)).toBe(true);
  });

  it("serves the page when the API can't be reached: an outage is not a sign-out", async () => {
    sessionVerdict.mockResolvedValue("unknown");
    const res = await visit("/news-feed", "good");
    expect(served(res)).toBe(true);
    expect(cookieDropped(res)).toBe(false);
  });
});

// Audit B2: this server can't download Google's signing keys (a cold start during a Google outage).
// It then knows nothing about the cookie, which must not be read as "forged".
describe("shared post links", () => {
  const ID = "6afc34d22644cd9c608d34dc";
  const rewrittenTo = (res: Response) => res.headers.get("x-middleware-rewrite");

  it("show someone not signed in the post's public preview, keeping the address", async () => {
    const res = await visit(`/p/${ID}?ref=ADA7K`);
    expect(rewrittenTo(res)).toBe(`http://localhost:3000/shared/p/${ID}?ref=ADA7K`);
    expect(redirectedTo(res)).toBeNull();
  });

  it("give a signed-in neighbour the app's post page", async () => {
    const res = await visit(`/p/${ID}`, "good");
    expect(served(res)).toBe(true);
    expect(rewrittenTo(res)).toBeNull();
  });

  it("open a neighbour's personal invite link to anyone; the Invite page stays behind the login", async () => {
    expect(served(await visit("/i/ADA7K?src=qr"))).toBe(true);
    expect(served(await visit("/i/ADA7K", "good"))).toBe(true);
    expect(redirectedTo(await visit("/invite"))).toMatch(/\/login\?next=%2Finvite/);
    expect(redirectedTo(await visit("/invite/poster"))).toMatch(/\/login\?next=/);
    // The app-link files Android and iOS fetch: never the login page.
    expect(served(await visit("/.well-known/apple-app-site-association"))).toBe(true);
    expect(served(await visit("/.well-known/assetlinks.json"))).toBe(true);
  });

  it("leave other app pages behind the login", async () => {
    expect(redirectedTo(await visit(`/p/${ID}/edit`))).toMatch(/\/login\?next=/);
    expect(redirectedTo(await visit("/news-feed"))).toBe("http://localhost:3000/login");
  });
});

describe("the page gate when this server can't check the cookie's signature", () => {
  beforeEach(() => {
    verifySessionCookie.mockRejectedValue(new VerifierUnavailableError());
  });

  it("keeps the cookie and lets the API decide: a live session gets its page", async () => {
    const res = await visit("/news-feed", "good");
    expect(sessionVerdict).toHaveBeenCalledWith("good");
    expect(served(res)).toBe(true);
    expect(cookieDropped(res)).toBe(false);
  });

  it("still turns away a cookie the API refuses (forged or revoked): the API checks the signature itself", async () => {
    sessionVerdict.mockResolvedValue("revoked");
    const res = await visit("/news-feed", "forged");
    expect(redirectedTo(res)).toBe("http://localhost:3000/login");
    expect(cookieDropped(res)).toBe(true);
  });

  it("with the API unreachable as well, the page loads and the cookie stays, exactly as in an API outage", async () => {
    sessionVerdict.mockResolvedValue("unknown");
    const res = await visit("/news-feed", "good");
    expect(served(res)).toBe(true);
    expect(cookieDropped(res)).toBe(false);
  });

  it("a failure that isn't about fetching keys is not swallowed", async () => {
    verifySessionCookie.mockRejectedValue(new Error("something else"));
    await expect(visit("/news-feed", "good")).rejects.toThrow("something else");
  });
});

describe("/ai", () => {
  it("goes to the AI Studio while admins have chosen it, signed in or not", async () => {
    hoodoraAiStudioUrl.mockResolvedValue("https://studio.myhoodora.com/");
    expect(redirectedTo(await visit("/ai"))).toBe("https://studio.myhoodora.com/");
    expect(redirectedTo(await visit("/ai", "good"))).toBe("https://studio.myhoodora.com/");
  });

  it("serves our own page while it's chosen, or when the API can't say", async () => {
    expect(served(await visit("/ai"))).toBe(true);
  });

  it("leaves every other page alone", async () => {
    hoodoraAiStudioUrl.mockResolvedValue("https://studio.myhoodora.com/");
    expect(served(await visit("/about"))).toBe(true);
    expect(hoodoraAiStudioUrl).not.toHaveBeenCalled();
  });
});
