import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

// Force the live branches; `direct` toggles the browser → storage path for videos.
const flags = { direct: true };
vi.mock("./config", async (orig) => ({ ...(await orig<typeof import("./config")>()), isLive: (k: string) => k !== "media.direct" || flags.direct, API_BASE_URL: "http://api.test" }));
const { checkPhoto, discardMedia, resolveImageUrl, uploadMedia } = await import("./media");

const user = { getIdToken: async () => "tok" } as unknown as User;
const photo = (type = "image/jpeg", size = 1000) => new File([new Uint8Array(size)], "p.jpg", { type });

afterEach(() => vi.unstubAllGlobals());

describe("checkPhoto", () => {
  it("accepts common photo types and rejects others or oversized ones", () => {
    expect(checkPhoto(photo("image/heic"))).toBeNull();
    expect(checkPhoto(photo("application/pdf"))).toMatch(/Choose a photo/);
    expect(checkPhoto(photo("image/png", 11 * 1024 * 1024))).toMatch(/under 10 MB/);
  });
});

describe("uploadMedia (live)", () => {
  it("posts multipart file + purpose with the bearer token and returns the stored media", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "m1", url: "https://res.cloudinary.com/x.jpg", resourceType: "image" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const media = await uploadMedia(user, photo(), "post");
    expect(media).toEqual({ id: "m1", url: "https://res.cloudinary.com/x.jpg", resourceType: "image" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/media");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    // The browser sets the multipart boundary; we must not force a JSON content type.
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    const body = init.body as FormData;
    expect(body.get("purpose")).toBe("post");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("never calls the API for a file it can already tell is wrong", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadMedia(user, photo("text/plain"), "post")).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discardMedia is fire-and-forget: a failed delete never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(() => discardMedia(user, "m1")).not.toThrow();
  });
});

describe("resolveImageUrl", () => {
  it("only takes https URLs", () => {
    expect(resolveImageUrl(" https://x.test/a.jpg ")).toBe("https://x.test/a.jpg");
    expect(() => resolveImageUrl("http://x.test/a.jpg")).toThrow(/https/);
  });
});

describe("uploadMedia video (direct to storage)", () => {
  it("gets a ticket, uploads straight to the provider (no API token), then completes", async () => {
    const calls: { url: string; auth?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).Authorization });
      if (url.endsWith("/media/direct")) {
        expect(JSON.parse(init.body as string)).toEqual({ purpose: "post", mimetype: "video/mp4", size: 1000 });
        return new Response(JSON.stringify({ id: "m9", upload: { url: "https://upload.provider.test/video", fields: { public_id: "x", signature: "s" }, fileField: "file", expiresAt: "" } }), { status: 201 });
      }
      return new Response(JSON.stringify({ id: "m9", url: "https://res.cloudinary.com/v.mp4", resourceType: "video" }), { status: 200 });
    }));
    const sent: { url: string; form: FormData; headers: Record<string, string> }[] = [];
    class FakeXhr {
      upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
      status = 200;
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      private url = "";
      private headers: Record<string, string> = {};
      open(_m: string, url: string) { this.url = url; }
      setRequestHeader(k: string, v: string) { this.headers[k] = v; }
      send(form: FormData) {
        sent.push({ url: this.url, form, headers: this.headers });
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1000, total: 1000 });
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress: number[] = [];
    const media = await uploadMedia(user, new File([new Uint8Array(1000)], "clip.mp4", { type: "video/mp4" }), "post", (f) => progress.push(f));
    expect(media).toMatchObject({ id: "m9", resourceType: "video" });
    expect(sent[0]!.url).toBe("https://upload.provider.test/video");
    expect(sent[0]!.headers.Authorization).toBeUndefined();
    expect(sent[0]!.form.get("public_id")).toBe("x");
    expect(sent[0]!.form.get("file")).toBeInstanceOf(File);
    expect(progress).toEqual([1]);
    expect(calls.map((c) => c.url)).toEqual(["http://api.test/media/direct", "http://api.test/media/m9/complete"]);
  });
});

describe("uploadMedia video (direct uploads off: through the API)", () => {
  it("posts the video to /media with progress, without asking for a ticket", async () => {
    flags.direct = false;
    try {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const sent: string[] = [];
      class FakeXhr {
        upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
        status = 201;
        responseText = JSON.stringify({ id: "m7", url: "https://res.cloudinary.com/v.mp4", resourceType: "video" });
        timeout = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        ontimeout: (() => void) | null = null;
        open(_m: string, url: string) { sent.push(url); }
        setRequestHeader() {}
        send() {
          this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
          expect(this.timeout).toBe(20 * 60_000);
          this.onload?.();
        }
      }
      vi.stubGlobal("XMLHttpRequest", FakeXhr);
      const progress: number[] = [];
      const media = await uploadMedia(user, new File([new Uint8Array(1000)], "clip.mp4", { type: "video/mp4" }), "post", (f) => progress.push(f));
      expect(media.id).toBe("m7");
      expect(sent).toEqual(["http://api.test/media"]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(progress).toEqual([0.5]);
    } finally {
      flags.direct = true;
    }
  });
});
