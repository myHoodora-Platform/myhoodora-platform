import type { ConfigService } from "@nestjs/config";
import { CloudinaryStorageAdapter } from "./providers/cloudinary-storage.adapter";
import { createStorageProvider } from "./storage.module";

const config = (values: Record<string, string | undefined>) => ({ get: (k: string) => values[k] }) as unknown as ConfigService;
const logger = { log: jest.fn(), warn: jest.fn() } as never;

describe("createStorageProvider", () => {
  it("builds the Cloudinary adapter from CLOUDINARY_URL", () => {
    const p = createStorageProvider(config({ "storage.provider": "cloudinary", "storage.cloudinaryUrl": "cloudinary://k:s@demo" }), logger);
    expect(p).toBeInstanceOf(CloudinaryStorageAdapter);
  });
  it("turns uploads off (null) when the URL is missing", () => {
    expect(createStorageProvider(config({ "storage.provider": "cloudinary" }), logger)).toBeNull();
  });
  it("fails at startup for a provider without an adapter", () => {
    expect(() => createStorageProvider(config({ "storage.provider": "supabase" }), logger)).toThrow(/has no adapter yet/);
  });
});
