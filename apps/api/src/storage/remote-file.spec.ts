import { readFileSync } from "node:fs";
import { fetchRemoteFile, isPrivateAddress, RemoteFileError } from "./remote-file";
import { removeTemp } from "./temp-files";

const PUBLIC = async (_host: string) => ["93.184.216.34"];
const file = (body: string, headers: Record<string, string> = {}, status = 200) => new Response(body, { status, headers: { "content-type": "video/mp4", ...headers } });

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local (cloud metadata) and IPv6 local ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });
});

describe("fetchRemoteFile", () => {
  it("follows redirects (re-checking each hop) and returns the file", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://videos.example.com/clip.mp4" } }))
      .mockResolvedValueOnce(file("abc"));
    const resolveHost = jest.fn(PUBLIC);
    const got = await fetchRemoteFile("https://www.example.com/download/1", { maxBytes: 100, fetchImpl, resolveHost });
    expect(got).toMatchObject({ mimetype: "video/mp4", size: 3 });
    expect(readFileSync(got.path, "utf8")).toBe("abc");
    await removeTemp(got.path);
    expect(resolveHost.mock.calls.map((c) => c[0])).toEqual(["www.example.com", "videos.example.com"]);
  });

  it("refuses http, private hosts, and redirects into private networks", async () => {
    await expect(fetchRemoteFile("http://example.com/a.mp4", { maxBytes: 100, fetchImpl: jest.fn(), resolveHost: PUBLIC })).rejects.toThrow(/https/);
    await expect(fetchRemoteFile("https://169.254.169.254/latest", { maxBytes: 100, fetchImpl: jest.fn() })).rejects.toBeInstanceOf(RemoteFileError);
    const fetchImpl = jest.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://internal.example/x" } }));
    const resolveHost = jest.fn(async (h: string) => (h === "internal.example" ? ["10.0.0.5"] : ["93.184.216.34"]));
    await expect(fetchRemoteFile("https://example.com/r", { maxBytes: 100, fetchImpl, resolveHost })).rejects.toThrow(/can't be used/);
  });

  it("leaves no temp file behind when a download is aborted", async () => {
    const { readdirSync } = await import("node:fs");
    const { UPLOAD_TMP_DIR } = await import("./temp-files");
    const before = readdirSync(UPLOAD_TMP_DIR).filter((n) => n.startsWith("link-")).length;
    await expect(fetchRemoteFile("https://e.com/a.mp4", { maxBytes: 2, fetchImpl: jest.fn().mockResolvedValue(file("abcdef")), resolveHost: PUBLIC })).rejects.toThrow(/too big/);
    await new Promise((r) => setTimeout(r, 50));
    expect(readdirSync(UPLOAD_TMP_DIR).filter((n) => n.startsWith("link-")).length).toBe(before);
  });

  it("rejects files over the limit, by header or while streaming", async () => {
    await expect(fetchRemoteFile("https://e.com/a.mp4", { maxBytes: 2, fetchImpl: jest.fn().mockResolvedValue(file("abc", { "content-length": "3" })), resolveHost: PUBLIC })).rejects.toThrow(/too big/);
    await expect(fetchRemoteFile("https://e.com/a.mp4", { maxBytes: 2, fetchImpl: jest.fn().mockResolvedValue(file("abc")), resolveHost: PUBLIC })).rejects.toThrow(/too big/);
  });

  it("rejects web pages, but trusts a known extension for octet-stream", async () => {
    await expect(fetchRemoteFile("https://e.com/page", { maxBytes: 100, fetchImpl: jest.fn().mockResolvedValue(file("<html>", { "content-type": "text/html" })), resolveHost: PUBLIC })).rejects.toThrow(/isn't a photo or video/);
    const got = await fetchRemoteFile("https://e.com/v/clip.MOV", { maxBytes: 100, fetchImpl: jest.fn().mockResolvedValue(file("x", { "content-type": "application/octet-stream" })), resolveHost: PUBLIC });
    expect(got.mimetype).toBe("video/quicktime");
    await removeTemp(got.path);
  });

  it("reports an unreachable link or HTTP error plainly", async () => {
    await expect(fetchRemoteFile("https://e.com/x.jpg", { maxBytes: 100, fetchImpl: jest.fn().mockResolvedValue(file("", {}, 404)), resolveHost: PUBLIC })).rejects.toThrow(/HTTP 404/);
    await expect(fetchRemoteFile("https://e.com/x.jpg", { maxBytes: 100, fetchImpl: jest.fn().mockRejectedValue(new Error("ECONNRESET")), resolveHost: PUBLIC })).rejects.toThrow(/couldn't download/);
  });
});
