import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hoodoraAiStudioUrl, resetHoodoraAiCache, safeStudioUrl } from "./hoodora-ai";

const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const fetchMock = vi.fn();

beforeEach(() => {
  resetHoodoraAiCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("hoodoraAiStudioUrl", () => {
  it("is the studio's address while admins have chosen it", async () => {
    fetchMock.mockReturnValue(reply({ analytics: { reaskDays: 180 }, links: { hoodoraAiStudio: "https://studio.myhoodora.com/" } }));
    expect(await hoodoraAiStudioUrl()).toBe("https://studio.myhoodora.com/");
  });

  it("is null while our own page is chosen, from an older API, or when the API fails", async () => {
    fetchMock.mockReturnValueOnce(reply({ analytics: { reaskDays: 180 }, links: { hoodoraAiStudio: null } }));
    expect(await hoodoraAiStudioUrl()).toBeNull();
    resetHoodoraAiCache();
    fetchMock.mockReturnValueOnce(reply({ analytics: { reaskDays: 180 } }));
    expect(await hoodoraAiStudioUrl()).toBeNull();
    resetHoodoraAiCache();
    fetchMock.mockReturnValueOnce(reply({}, 503));
    expect(await hoodoraAiStudioUrl()).toBeNull();
    resetHoodoraAiCache();
    fetchMock.mockReturnValueOnce(Promise.reject(new Error("offline")));
    expect(await hoodoraAiStudioUrl()).toBeNull();
  });

  it("asks the API at most once a minute", async () => {
    fetchMock.mockReturnValue(reply({ links: { hoodoraAiStudio: "https://studio.myhoodora.com/" } }));
    await Promise.all([hoodoraAiStudioUrl(), hoodoraAiStudioUrl()]);
    await hoodoraAiStudioUrl(Date.now() + 30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await hoodoraAiStudioUrl(Date.now() + 61_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("safeStudioUrl", () => {
  it("only follows https addresses", () => {
    expect(safeStudioUrl("https://studio.myhoodora.com/")).toBe("https://studio.myhoodora.com/");
    expect(safeStudioUrl("http://studio.myhoodora.com/")).toBeNull();
    expect(safeStudioUrl("javascript:alert(1)")).toBeNull();
    expect(safeStudioUrl("not a url")).toBeNull();
    expect(safeStudioUrl(null)).toBeNull();
  });
});
