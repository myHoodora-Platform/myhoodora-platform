import { BadRequestException, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Types } from "mongoose";
import { StorageError, type StorageProvider } from "./providers/storage-provider";
import { StorageService } from "./storage.service";

const settings: Record<string, unknown> = { "storage.folder": "myhoodora/test", "storage.directUploads": true, "storage.maxConcurrentUploads": 4 };
const config = { get: (k: string) => settings[k] } as unknown as ConfigService;
/** Real leading bytes per type, since the service reads the type from the file, not the label. */
const MAGIC: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  "image/png": Buffer.from("\x89PNG\r\n\x1a\n", "latin1"),
  "video/mp4": Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")]),
  "application/pdf": Buffer.from("%PDF-1.7"),
};
const file = (mimetype: string, size = 1000, bytes = mimetype) => ({ buffer: MAGIC[bytes] ?? Buffer.from("x"), mimetype, size });

function fakeProvider(overrides: Partial<StorageProvider> = {}): jest.Mocked<StorageProvider> {
  return {
    name: "fake",
    upload: jest.fn(async (f) => ({ providerId: `${f.folder}/abc`, url: "https://cdn.test/abc", resourceType: f.resourceType, format: "jpg", bytes: 1000, width: 10, height: 10 })),
    delete: jest.fn(async () => undefined),
    url: jest.fn((id: string) => `https://cdn.test/${id}`),
    ...overrides,
  } as jest.Mocked<StorageProvider>;
}

/** Just enough of the Mongoose model: create + findOne(...).exec() + deleteOne. */
function fakeModel() {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    create: jest.fn(async (data: Record<string, unknown>) => {
      const doc: Record<string, unknown> = { _id: new Types.ObjectId(), status: "ready", url: "", bytes: 0, ...data };
      doc.deleteOne = jest.fn(async () => void rows.splice(rows.indexOf(doc), 1));
      doc.save = jest.fn(async () => doc);
      rows.push(doc);
      return doc;
    }),
    findOne: jest.fn((q: { _id?: string; ownerUid: string; url?: string }) => ({
      exec: async () => rows.find((r) => (q._id ? String(r._id) === q._id : r.url === q.url) && r.ownerUid === q.ownerUid) ?? null,
    })),
  };
}

const make = (provider: StorageProvider | null, model = fakeModel()) => ({ model, service: new StorageService(provider, model as never, config) });

describe("StorageService", () => {
  it("stores a photo under the environment + purpose folder and records the owner", async () => {
    const provider = fakeProvider();
    const { service, model } = make(provider);
    const asset = await service.upload("u1", file("image/jpeg"), "post");
    expect(provider.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: "myhoodora/test/post", resourceType: "image", mimeType: "image/jpeg", source: { buffer: MAGIC["image/jpeg"] } }));
    expect(asset).toMatchObject({ url: "https://cdn.test/abc", resourceType: "image", bytes: 1000 });
    expect(model.rows[0]).toMatchObject({ ownerUid: "u1", provider: "fake", providerId: "myhoodora/test/post/abc", purpose: "post" });
  });

  it("reads the real type from the bytes: a PDF named .jpg is refused, a mislabelled video is still a video", async () => {
    const provider = fakeProvider();
    const { service } = make(provider);
    await expect(service.upload("u1", file("image/jpeg", 1000, "application/pdf"), "post")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload("u1", file("image/jpeg", 1000, "video/mp4"), "post")).resolves.toMatchObject({ resourceType: "video" });
    expect(provider.upload).toHaveBeenLastCalledWith(expect.objectContaining({ mimeType: "video/mp4", resourceType: "video" }));
  });

  it("streams from a temp file when the upload is on disk (never loaded into memory)", async () => {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { UPLOAD_TMP_DIR, removeTemp } = await import("./temp-files");
    const path = join(UPLOAD_TMP_DIR, "spec-clip");
    writeFileSync(path, Buffer.concat([MAGIC["video/mp4"]!, Buffer.alloc(64)]));
    const provider = fakeProvider();
    await make(provider).service.upload("u1", { path, mimetype: "video/mp4", size: 80 * 1024 * 1024 }, "post");
    expect(provider.upload).toHaveBeenCalledWith(expect.objectContaining({ source: { path }, resourceType: "video" }));
    await removeTemp(path);
  });

  it("accepts video for posts only", async () => {
    const { service } = make(fakeProvider());
    await expect(service.upload("u1", file("video/mp4"), "post")).resolves.toMatchObject({ resourceType: "video" });
    await expect(service.upload("u1", file("video/mp4"), "avatar")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects (and deletes) videos longer than 60 seconds", async () => {
    const provider = fakeProvider({
      upload: jest.fn(async () => ({ providerId: "v1", url: "https://cdn.test/v1.mp4", resourceType: "video" as const, bytes: 1000, durationSeconds: 95 })),
    });
    const { service, model } = make(provider);
    await expect(service.upload("u1", file("video/mp4"), "post")).rejects.toThrow(/up to 60 seconds/);
    expect(provider.delete).toHaveBeenCalledWith("v1", "video");
    expect(model.rows).toHaveLength(0);
  });

  it("cleans up a replaced file by URL, only for its owner, and never throws", async () => {
    const provider = fakeProvider();
    const { service, model } = make(provider);
    const { url } = await service.upload("u1", file("image/jpeg"), "avatar");
    await service.discardByUrl("someone-else", url);
    expect(provider.delete).not.toHaveBeenCalled();
    await service.discardByUrl("u1", url);
    expect(provider.delete).toHaveBeenCalledTimes(1);
    expect(model.rows).toHaveLength(0);
    await expect(service.discardByUrl("u1", "https://lh3.googleusercontent.com/me.jpg")).resolves.toBeUndefined();
  });

  it("rejects unsupported types and oversized files before calling the provider", async () => {
    const provider = fakeProvider();
    const { service } = make(provider);
    await expect(service.upload("u1", file("application/pdf"), "post")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload("u1", file("image/png", 11 * 1024 * 1024), "post")).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.upload("u1", file("video/mp4", 101 * 1024 * 1024), "post")).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("maps provider failures: refused file → 400, outage → 503", async () => {
    const refused = make(fakeProvider({ upload: jest.fn().mockRejectedValue(new StorageError("rejected", "x")) })).service;
    await expect(refused.upload("u1", file("image/jpeg"), "post")).rejects.toBeInstanceOf(BadRequestException);
    const down = make(fakeProvider({ upload: jest.fn().mockRejectedValue(new Error("socket hang up")) })).service;
    await expect(down.upload("u1", file("image/jpeg"), "post")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("answers 503 when no provider is configured", async () => {
    const { service } = make(null);
    expect(service.enabled).toBe(false);
    await expect(service.upload("u1", file("image/jpeg"), "post")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("deletes only the owner's files, through the provider that stored them", async () => {
    const provider = fakeProvider();
    const { service, model } = make(provider);
    const { id } = await service.upload("u1", file("image/jpeg"), "post");
    await expect(service.delete("someone-else", id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.delete("u1", "not-an-id")).rejects.toBeInstanceOf(NotFoundException);
    await service.delete("u1", id);
    expect(provider.delete).toHaveBeenCalledWith("myhoodora/test/post/abc", "image");
    expect(model.rows).toHaveLength(0);
  });

  it("keeps the record if the provider delete fails", async () => {
    const provider = fakeProvider({ delete: jest.fn().mockRejectedValue(new StorageError("unavailable", "x")) });
    const { service, model } = make(provider);
    const { id } = await service.upload("u1", file("image/jpeg"), "post");
    await expect(service.delete("u1", id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(model.rows).toHaveLength(1);
  });

  describe("direct upload", () => {
    const direct = (overrides: Partial<StorageProvider> = {}) =>
      fakeProvider({
        createDirectUpload: jest.fn(({ providerId }) => ({ url: "https://up.test", fields: { public_id: providerId }, fileField: "file", expiresAt: "2026-01-01T00:00:00Z" })),
        describe: jest.fn(async (providerId: string) => ({ providerId, url: `https://cdn.test/${providerId}.mp4`, resourceType: "video" as const, format: "mp4", bytes: 80 * 1024 * 1024, durationSeconds: 12 })),
        ...overrides,
      });
    const video = { purpose: "post" as const, mimetype: "video/mp4", size: 80 * 1024 * 1024 };

    it("issues a ticket for a new file id in the purpose folder and records it as pending", async () => {
      const provider = direct();
      const { service, model } = make(provider);
      const { id, upload } = await service.createDirectUpload("u1", video);
      expect(upload?.fields.public_id).toMatch(/^myhoodora\/test\/post\/[\w-]{16}$/);
      expect(model.rows[0]).toMatchObject({ ownerUid: "u1", status: "pending", resourceType: "video", providerId: upload?.fields.public_id });
      expect(String(model.rows[0]!._id)).toBe(id);
    });

    it("is off unless STORAGE_DIRECT_UPLOADS is on (the free plan's Admin API quota)", async () => {
      settings["storage.directUploads"] = false;
      try {
        await expect(make(direct()).service.createDirectUpload("u1", video)).resolves.toEqual({ id: null, upload: null });
      } finally {
        settings["storage.directUploads"] = true;
      }
    });

    it("returns nulls for photos and for providers without direct upload (use POST /media)", async () => {
      const { service } = make(direct());
      await expect(service.createDirectUpload("u1", { purpose: "post", mimetype: "image/jpeg", size: 1000 })).resolves.toEqual({ id: null, upload: null });
      await expect(make(fakeProvider()).service.createDirectUpload("u1", video)).resolves.toEqual({ id: null, upload: null });
    });

    it("applies type, purpose and the 100 MB limit before signing", async () => {
      const { service } = make(direct());
      await expect(service.createDirectUpload("u1", { ...video, purpose: "avatar" })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.createDirectUpload("u1", { ...video, size: 101 * 1024 * 1024 })).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it("completes from what storage actually holds, only for the owner, and is idempotent", async () => {
      const provider = direct();
      const { service } = make(provider);
      const { id } = await service.createDirectUpload("u1", video);
      await expect(service.completeDirectUpload("someone-else", id!)).rejects.toBeInstanceOf(NotFoundException);
      const done = await service.completeDirectUpload("u1", id!);
      expect(done).toMatchObject({ id, resourceType: "video", bytes: 80 * 1024 * 1024, durationSeconds: 12 });
      expect(done.url).toMatch(/\.mp4$/);
      await service.completeDirectUpload("u1", id!);
      expect(provider.describe).toHaveBeenCalledTimes(1);
    });

    it("deletes and refuses a stored video that breaks the limits (whatever the browser claimed)", async () => {
      const long = direct({ describe: jest.fn(async (providerId: string) => ({ providerId, url: "u", resourceType: "video" as const, bytes: 1000, durationSeconds: 90 })) });
      const a = make(long);
      const t1 = await a.service.createDirectUpload("u1", { ...video, size: 1000 });
      await expect(a.service.completeDirectUpload("u1", t1.id!)).rejects.toThrow(/60 seconds/);
      expect(long.delete).toHaveBeenCalled();
      expect(a.model.rows).toHaveLength(0);

      const big = direct({ describe: jest.fn(async (providerId: string) => ({ providerId, url: "u", resourceType: "video" as const, bytes: 150 * 1024 * 1024, durationSeconds: 10 })) });
      const b = make(big);
      const t2 = await b.service.createDirectUpload("u1", { ...video, size: 1000 });
      await expect(b.service.completeDirectUpload("u1", t2.id!)).rejects.toBeInstanceOf(PayloadTooLargeException);
      expect(b.model.rows).toHaveLength(0);
    });

    it("says so when nothing was uploaded", async () => {
      const { service } = make(direct({ describe: jest.fn(async () => null) }));
      const { id } = await service.createDirectUpload("u1", video);
      await expect(service.completeDirectUpload("u1", id!)).rejects.toThrow(/didn't receive/);
    });
  });

  describe("UploadGate", () => {
    it("runs at most N at once, queues a few more, and turns the rest away with 503", async () => {
      const { UploadGate } = await import("./storage.service");
      const gate = new UploadGate(2, 1);
      let running = 0;
      let peak = 0;
      const releases: (() => void)[] = [];
      const job = () =>
        gate.run(async () => {
          running++;
          peak = Math.max(peak, running);
          await new Promise<void>((r) => releases.push(r));
          running--;
        });
      const a = job();
      const b = job();
      const c = job(); // queued
      await expect(job()).rejects.toBeInstanceOf(ServiceUnavailableException); // queue full
      await Promise.resolve();
      expect(releases).toHaveLength(2);
      releases.shift()!();
      await a;
      await new Promise((r) => setImmediate(r));
      expect(releases).toHaveLength(2); // the queued one started
      releases.forEach((r) => r());
      await Promise.all([b, c]);
      expect(peak).toBe(2);
    });
  });
});
