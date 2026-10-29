import type { User } from "@firebase/auth";
import { ApiError } from "@myhoodora/api-contract/errors";
import { reportEdgePage } from "@/core/monitoring/monitoring";
import { apiFetch, webFetch } from "../client";

jest.mock("@/core/monitoring/monitoring", () => ({ reportEdgePage: jest.fn() }));

const user = { getIdToken: () => Promise.resolve("token") } as unknown as User;
const CHALLENGE = "<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>";

function answer(status: number, body: string, headers: Record<string, string> = {}) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("a web page in place of the API", () => {
  it("is reported with the host, the route's first two parts and Cloudflare's headers, and reads as unreachable", async () => {
    answer(403, CHALLENGE, { server: "cloudflare", "cf-mitigated": "challenge", "cf-ray": "8f1a-LOS" });
    const error = await apiFetch(user, "/users/abc123/followers?page=2").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("network");
    expect(reportEdgePage).toHaveBeenCalledWith({ status: 403, host: "api.test", route: "/api/users", server: "cloudflare", mitigated: "challenge", ray: "8f1a-LOS" });
  });

  it("is reported when it comes back as a 200 too", async () => {
    answer(200, CHALLENGE);
    await expect(webFetch(user, "/api/geocode?q=Yaba")).rejects.toMatchObject({ kind: "server" });
    expect(reportEdgePage).toHaveBeenCalledWith(expect.objectContaining({ status: 200, host: "web.test", route: "/api/geocode", server: null }));
  });

  it("is not confused with the API's own errors", async () => {
    answer(503, JSON.stringify({ message: "Service Unavailable" }));
    await expect(apiFetch(user, "/feed")).rejects.toMatchObject({ kind: "server" });
    answer(400, "Title is too long");
    await expect(apiFetch(user, "/posts", { method: "POST", json: {} })).rejects.toMatchObject({ kind: "client" });
    expect(reportEdgePage).not.toHaveBeenCalled();
  });
});
