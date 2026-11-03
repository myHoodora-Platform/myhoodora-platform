import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { clearServerSession, requireServerSession, syncServerSession } from "./session-sync";

function userWith(getIdToken: (force?: boolean) => Promise<string>, uid = "ada"): User {
  return { uid, getIdToken } as unknown as User;
}
const reply = (status: number) => new Response("{}", { status });
const fetchMock = () => vi.mocked(globalThis.fetch);

afterEach(() => vi.unstubAllGlobals());

describe("syncServerSession", () => {
  it("posts the ID token and reports ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200)));
    expect(await syncServerSession(userWith(async () => "tok"))).toBe("ok");
    const [url, init] = fetchMock().mock.calls[0]!;
    expect(url).toBe("/api/auth/session");
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ idToken: "tok" }) });
  });

  it("shares one request between callers asking at the same moment", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (release = r))));
    const user = userWith(async () => "tok");
    const all = Promise.all([syncServerSession(user), syncServerSession(user), syncServerSession(user)]);
    await vi.waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    release(reply(200));
    expect(await all).toEqual(["ok", "ok", "ok"]);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("asks again next time: a finished sync is never reused (the cookie may have gone since)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200)));
    const user = userWith(async () => "tok");
    await syncServerSession(user);
    await syncServerSession(user);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("does not hand one account's answer to another", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => reply(String(init.body).includes("tok-ada") ? 200 : 503)));
    const [ada, tunde] = await Promise.all([
      syncServerSession(userWith(async () => "tok-ada", "ada")),
      syncServerSession(userWith(async () => "tok-tunde", "tunde")),
    ]);
    expect([ada, tunde]).toEqual(["ok", "unavailable"]);
  });

  it("a refused token is retried once with a fresh one before giving up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200)));
    const getIdToken = vi.fn(async (force?: boolean) => (force ? "fresh" : "stale"));
    expect(await syncServerSession(userWith(getIdToken))).toBe("ok");
    expect(getIdToken.mock.calls).toEqual([[false], [true]]);
  });

  it("reports rejected when the fresh token is refused too, or Firebase won't issue one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(401)));
    expect(await syncServerSession(userWith(async () => "tok"))).toBe("rejected");
    const revoked = userWith(async (force) => {
      if (force) throw Object.assign(new Error("revoked"), { code: "auth/user-token-expired" });
      return "tok";
    });
    expect(await syncServerSession(revoked)).toBe("rejected");
  });

  it("reports unavailable (never rejected) when it simply can't find out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(503)));
    expect(await syncServerSession(userWith(async () => "tok"))).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await syncServerSession(userWith(async () => "tok"))).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => reply(401)));
    const offline = userWith(async (force) => {
      if (force) throw Object.assign(new Error("offline"), { code: "auth/network-request-failed" });
      return "tok";
    });
    expect(await syncServerSession(offline)).toBe("unavailable");
  });
});

describe("requireServerSession", () => {
  it("resolves when the session is in place, and throws a readable error otherwise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200)));
    await expect(requireServerSession(userWith(async () => "tok"))).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => reply(503)));
    await expect(requireServerSession(userWith(async () => "tok"))).rejects.toMatchObject({ kind: "network" });
    vi.stubGlobal("fetch", vi.fn(async () => reply(401)));
    await expect(requireServerSession(userWith(async () => "tok"))).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("clearServerSession", () => {
  it("clears once for simultaneous callers and never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200)));
    await Promise.all([clearServerSession(), clearServerSession()]);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(fetchMock().mock.calls[0]).toEqual(["/api/auth/logout", { method: "POST" }]);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(clearServerSession()).resolves.toBeUndefined();
    quiet.mockRestore();
  });
});
