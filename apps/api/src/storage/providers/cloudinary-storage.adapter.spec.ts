import { Writable } from "node:stream";
import { CloudinaryStorageAdapter, parseCloudinaryUrl } from "./cloudinary-storage.adapter";
import { StorageError } from "./storage-provider";

type Callback = (err?: { http_code: number; message: string }, res?: Record<string, unknown>) => void;

/** A fake SDK: records config + upload options, answers with `respond`. */
function fakeSdk(respond: (cb: Callback) => void, destroyResult: unknown = { result: "ok" }, resource: () => Promise<unknown> = async () => ({})) {
  const calls: { config?: unknown; options?: Record<string, unknown>; bytes?: Buffer } = {};
  const sdk = {
    utils: { api_sign_request: jest.fn((params: Record<string, unknown>, secret: string) => `sig(${Object.keys(params).sort().join(",")}|${secret})`) },
    api: { resource: jest.fn(resource) },
    config: jest.fn((c: unknown) => (calls.config = c)),
    url: jest.fn((id: string, o: Record<string, unknown>) => `https://res.cloudinary.com/demo/${o.resource_type}/upload/f_auto,q_auto/${id}`),
    uploader: {
      upload: jest.fn(async (path: string, options: Record<string, unknown>) => {
        calls.options = options;
        return { public_id: `from-disk:${path}`, format: "jpg", bytes: 5 };
      }),
      upload_stream: jest.fn((options: Record<string, unknown>, cb: Callback) => {
        calls.options = options;
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _e, next) {
            chunks.push(chunk);
            next();
          },
          final(done) {
            calls.bytes = Buffer.concat(chunks);
            respond(cb);
            done();
          },
        });
      }),
      destroy: jest.fn(async () => destroyResult),
    },
  };
  return { sdk, calls };
}

const URL = "cloudinary://123456:s3cr3t-value@demo";
const upload = { source: { buffer: Buffer.from("photo-bytes") }, mimeType: "image/jpeg", resourceType: "image" as const, folder: "myhoodora/test/post" };

describe("parseCloudinaryUrl", () => {
  it("splits key, secret and cloud", () => {
    expect(parseCloudinaryUrl(URL)).toEqual({ apiKey: "123456", apiSecret: "s3cr3t-value", cloudName: "demo" });
  });
  it("rejects a malformed URL without echoing it", () => {
    expect(() => parseCloudinaryUrl("https://s3cr3t@demo")).toThrow(/must look like/);
    expect(() => parseCloudinaryUrl("https://s3cr3t@demo")).not.toThrow(/s3cr3t/);
  });
});

describe("CloudinaryStorageAdapter", () => {
  it("configures the SDK from CLOUDINARY_URL with secure URLs", () => {
    const { sdk, calls } = fakeSdk(() => undefined);
    new CloudinaryStorageAdapter(URL, sdk as never);
    expect(calls.config).toEqual({ cloud_name: "demo", api_key: "123456", api_secret: "s3cr3t-value", secure: true });
  });

  it("streams the bytes into the folder and returns the optimised HTTPS URL + metadata", async () => {
    const { sdk, calls } = fakeSdk((cb) => cb(undefined, { public_id: "myhoodora/test/post/abc", format: "jpg", bytes: 11, width: 800, height: 600 }));
    const adapter = new CloudinaryStorageAdapter(URL, sdk as never);
    const stored = await adapter.upload(upload);
    expect(calls.bytes?.toString()).toBe("photo-bytes");
    expect(calls.options).toMatchObject({ resource_type: "image", folder: "myhoodora/test/post", unique_filename: true, overwrite: false });
    expect(calls.options?.transformation).toEqual([{ width: 2560, height: 2560, crop: "limit" }]);
    expect(stored).toEqual({
      providerId: "myhoodora/test/post/abc",
      url: "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/myhoodora/test/post/abc",
      resourceType: "image",
      format: "jpg",
      bytes: 11,
      width: 800,
      height: 600,
      durationSeconds: undefined,
    });
  });

  it("delivers videos as capped MP4 and photos in the best format", () => {
    const { sdk } = fakeSdk(() => undefined);
    const adapter = new CloudinaryStorageAdapter(URL, sdk as never);
    adapter.url("f/clip", "video");
    expect(sdk.url).toHaveBeenLastCalledWith("f/clip", { resource_type: "video", secure: true, format: "mp4", quality: "auto", width: 1280, crop: "limit" });
    adapter.url("f/pic", "image");
    expect(sdk.url).toHaveBeenLastCalledWith("f/pic", { resource_type: "image", secure: true, fetch_format: "auto", quality: "auto" });
  });

  it("sends files on disk from disk in one streamed request (photos and videos)", async () => {
    const photo = fakeSdk(() => undefined);
    const p = await new CloudinaryStorageAdapter(URL, photo.sdk as never).upload({ ...upload, source: { path: "/tmp/p.jpg" } });
    expect(photo.sdk.uploader.upload).toHaveBeenCalledWith("/tmp/p.jpg", expect.objectContaining({ resource_type: "image", folder: "myhoodora/test/post" }));
    expect(p.providerId).toBe("from-disk:/tmp/p.jpg");
    const video = fakeSdk(() => undefined);
    await new CloudinaryStorageAdapter(URL, video.sdk as never).upload({ ...upload, resourceType: "video", mimeType: "video/mp4", source: { path: "/tmp/v.mp4" } });
    expect(video.sdk.uploader.upload).toHaveBeenCalledWith("/tmp/v.mp4", expect.objectContaining({ resource_type: "video", eager_async: true }));
    expect(video.sdk.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it("a refused file on disk is a 'rejected' error, an outage 'unavailable'", async () => {
    const refused = fakeSdk(() => undefined);
    refused.sdk.uploader.upload.mockRejectedValueOnce({ error: { http_code: 400, message: "Invalid video file" } });
    await expect(new CloudinaryStorageAdapter(URL, refused.sdk as never).upload({ ...upload, resourceType: "video", source: { path: "/tmp/x.mp4" } })).rejects.toMatchObject({ reason: "rejected" });
    const down = fakeSdk(() => undefined);
    down.sdk.uploader.upload.mockRejectedValueOnce(new Error("ENOENT"));
    await expect(new CloudinaryStorageAdapter(URL, down.sdk as never).upload({ ...upload, source: { path: "/tmp/gone.jpg" } })).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("uploads video without the photo resize and keeps its duration", async () => {
    const { sdk, calls } = fakeSdk((cb) => cb(undefined, { public_id: "v1", format: "mp4", bytes: 99, width: 1280, height: 720, duration: 12.5 }));
    const stored = await new CloudinaryStorageAdapter(URL, sdk as never).upload({ ...upload, resourceType: "video", mimeType: "video/mp4" });
    expect(calls.options).toMatchObject({ resource_type: "video", eager: [{ format: "mp4", quality: "auto", width: 1280, crop: "limit" }], eager_async: true });
    expect(calls.options?.transformation).toBeUndefined();
    expect(stored.durationSeconds).toBe(12.5);
  });

  it("uses a given public id (overwriting) when asked", async () => {
    const { sdk, calls } = fakeSdk((cb) => cb(undefined, { public_id: "f/me", format: "jpg", bytes: 1 }));
    await new CloudinaryStorageAdapter(URL, sdk as never).upload({ ...upload, publicId: "me" });
    expect(calls.options).toMatchObject({ public_id: "me", overwrite: true });
  });

  it("classifies failures: a refused file is 'rejected', auth/outages are 'unavailable'", async () => {
    const refused = new CloudinaryStorageAdapter(URL, fakeSdk((cb) => cb({ http_code: 400, message: "Invalid image file" })).sdk as never);
    await expect(refused.upload(upload)).rejects.toMatchObject({ reason: "rejected" });
    const auth = new CloudinaryStorageAdapter(URL, fakeSdk((cb) => cb({ http_code: 401, message: "Invalid Signature" })).sdk as never);
    await expect(auth.upload(upload)).rejects.toMatchObject({ reason: "unavailable" });
    const down = new CloudinaryStorageAdapter(URL, fakeSdk((cb) => cb({ http_code: 500, message: "boom" })).sdk as never);
    await expect(down.upload(upload)).rejects.toBeInstanceOf(StorageError);
  });

  it("deletes by public id with CDN invalidation; 'not found' counts as done", async () => {
    const ok = fakeSdk(() => undefined);
    await new CloudinaryStorageAdapter(URL, ok.sdk as never).delete("f/abc", "video");
    expect(ok.sdk.uploader.destroy).toHaveBeenCalledWith("f/abc", { resource_type: "video", invalidate: true });
    await expect(new CloudinaryStorageAdapter(URL, fakeSdk(() => undefined, { result: "not found" }).sdk as never).delete("x", "image")).resolves.toBeUndefined();
    await expect(new CloudinaryStorageAdapter(URL, fakeSdk(() => undefined, { result: "error" }).sdk as never).delete("x", "image")).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("signs a direct video upload for exactly one file id, without exposing the secret", () => {
    const { sdk } = fakeSdk(() => undefined);
    const ticket = new CloudinaryStorageAdapter(URL, sdk as never).createDirectUpload({ providerId: "myhoodora/test/post/abc", resourceType: "video" });
    expect(ticket.url).toBe("https://api.cloudinary.com/v1_1/demo/video/upload");
    expect(ticket.fileField).toBe("file");
    expect(ticket.fields).toMatchObject({ public_id: "myhoodora/test/post/abc", eager: "c_limit,q_auto,w_1280/mp4", eager_async: "true", api_key: "123456" });
    // Signed with the secret server-side; the secret itself never appears in the ticket.
    expect(ticket.fields.signature).toBe("sig(eager,eager_async,public_id,timestamp|s3cr3t-value)");
    expect(JSON.stringify(ticket)).not.toContain("s3cr3t-value\"");
    expect(Object.values(ticket.fields)).not.toContain("s3cr3t-value");
    expect(new Date(ticket.expiresAt).getTime()).toBeGreaterThan(Date.now() + 50 * 60_000);
  });

  it("describes what was stored (real duration from media metadata), or null when nothing arrived", async () => {
    const found = fakeSdk(() => undefined, undefined, async () => ({ public_id: "p/v", format: "mp4", bytes: 1234, width: 1080, height: 1920, duration: 12.4 }));
    const adapter = new CloudinaryStorageAdapter(URL, found.sdk as never);
    await expect(adapter.describe("p/v", "video")).resolves.toMatchObject({ providerId: "p/v", bytes: 1234, durationSeconds: 12.4, resourceType: "video" });
    expect(found.sdk.api.resource).toHaveBeenCalledWith("p/v", { resource_type: "video", media_metadata: true });
    const missing = fakeSdk(() => undefined, undefined, async () => Promise.reject({ error: { http_code: 404, message: "Resource not found" } }));
    await expect(new CloudinaryStorageAdapter(URL, missing.sdk as never).describe("nope", "video")).resolves.toBeNull();
    const down = fakeSdk(() => undefined, undefined, async () => Promise.reject({ error: { http_code: 500, message: "boom" } }));
    await expect(new CloudinaryStorageAdapter(URL, down.sdk as never).describe("x", "video")).rejects.toMatchObject({ reason: "unavailable" });
  });
});
