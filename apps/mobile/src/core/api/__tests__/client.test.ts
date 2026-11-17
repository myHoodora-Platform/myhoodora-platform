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

describe("uploads (multipart)", () => {
  /** A stand-in XMLHttpRequest that records what was sent and answers with `status` / `body`. */
  function fakeXhr(status: number, body: string, fail = false) {
    const sent: { method?: string; url?: string; headers: Record<string, string>; body?: unknown } = { headers: {} };
    class FakeXhr {
      status = 0;
      responseText = "";
      onload?: () => void;
      onerror?: () => void;
      ontimeout?: () => void;
      onabort?: () => void;
      open(method: string, url: string) {
        sent.method = method;
        sent.url = url;
      }
      setRequestHeader(name: string, value: string) {
        sent.headers[name] = value;
      }
      getResponseHeader() {
        return null;
      }
      abort() {
        this.onabort?.();
      }
      send(data: unknown) {
        sent.body = data;
        setTimeout(() => {
          if (fail) return this.onerror?.();
          this.status = status;
          this.responseText = body;
          this.onload?.();
        }, 0);
      }
    }
    (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
    globalThis.fetch = jest.fn();
    return sent;
  }

  // expo/fetch (Expo 57's global fetch) can't send React Native's { uri, name, type } parts; XMLHttpRequest can.
  it("go through XMLHttpRequest, never fetch, with the token and no hand-set Content-Type", async () => {
    const sent = fakeXhr(201, JSON.stringify({ id: "m1", url: "https://cdn.test/m1.jpg" }));
    const form = new FormData();
    form.append("file", { uri: "file:///cache/photo.jpg", name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
    await expect(apiFetch(user, "/media", { method: "POST", body: form })).resolves.toEqual({ id: "m1", url: "https://cdn.test/m1.jpg" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(sent).toMatchObject({ method: "POST", url: "https://api.test/api/v1/media", body: form, headers: { Authorization: "Bearer token", Accept: "application/json" } });
    expect(Object.keys(sent.headers).map((h) => h.toLowerCase())).not.toContain("content-type");
  });

  it("read the API's refusals and lost connections like any other request", async () => {
    fakeXhr(413, JSON.stringify({ message: "That photo is too big" }));
    await expect(apiFetch(user, "/media", { method: "POST", body: new FormData() })).rejects.toMatchObject({ kind: "client" });
    fakeXhr(0, "", true);
    await expect(apiFetch(user, "/media", { method: "POST", body: new FormData() })).rejects.toMatchObject({ kind: "network" });
  });
});
