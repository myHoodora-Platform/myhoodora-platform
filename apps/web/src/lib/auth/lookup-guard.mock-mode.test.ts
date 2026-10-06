import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock mode (NEXT_PUBLIC_USE_MOCKS=true): no API, so no server session exists to check.
vi.mock("@/lib/api/config", () => ({ API_BASE_URL: "http://api.test/api", USE_MOCKS: true }));
const verifySessionCookie = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-cookie", () => ({ SESSION_COOKIE: "__session", VerifierUnavailableError: class extends Error {}, verifySessionCookie }));

const { guardLookup, resetLookupLimits } = await import("./lookup-guard");

const from = (ip: string) => new NextRequest("http://localhost:3000/api/geocode?address=x", { headers: { "x-forwarded-for": ip } });

beforeEach(() => resetLookupLimits());

describe("guardLookup in mock mode", () => {
  it("lets a visitor through without a session, which doesn't exist in this mode", async () => {
    expect(await guardLookup(from("102.89.1.1"), "geocode")).toBeNull();
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("still limits, by address since there is nobody to name; each route has its own allowance", async () => {
    for (let i = 0; i < 20; i++) expect(await guardLookup(from("102.89.1.1"), "geocode")).toBeNull();
    expect((await guardLookup(from("102.89.1.1"), "geocode"))?.status).toBe(429);
    expect(await guardLookup(from("102.89.1.2"), "geocode")).toBeNull();
    expect(await guardLookup(from("102.89.1.1"), "reverse-geocode")).toBeNull();
  });
});
