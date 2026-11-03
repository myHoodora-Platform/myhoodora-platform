import { Global, Logger, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CloudinaryStorageAdapter } from "./providers/cloudinary-storage.adapter";
import { STORAGE_PROVIDER, type StorageProvider } from "./providers/storage-provider";
import { MediaAsset, MediaAssetSchema } from "./schemas/media-asset.schema";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { sweepStaleTemps } from "./temp-files";

/**
 * Picks the storage adapter from STORAGE_PROVIDER. To add one (Supabase
 * Storage, Firebase Storage): implement StorageProvider in providers/ and add
 * a case here. Nothing else changes.
 */
export function createStorageProvider(config: ConfigService, logger = new Logger("Storage")): StorageProvider | null {
  const provider = config.get<string>("storage.provider") ?? "cloudinary";
  switch (provider) {
    case "cloudinary": {
      const url = config.get<string>("storage.cloudinaryUrl");
      if (!url) {
        logger.warn("CLOUDINARY_URL is not set: photo and video uploads are off (POST /media answers 503).");
        return null;
      }
      const adapter = new CloudinaryStorageAdapter(url);
      logger.log(`Storage: cloudinary (cloud ${adapter.cloudName}) · folder ${config.get<string>("storage.folder")}`);
      return adapter;
    }
    default:
      throw new Error(`STORAGE_PROVIDER "${provider}" has no adapter yet. Add one in src/storage/providers/ (see README "File storage").`);
  }
}

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: MediaAsset.name, schema: MediaAssetSchema }])],
  controllers: [StorageController],
  providers: [StorageService, { provide: STORAGE_PROVIDER, inject: [ConfigService], useFactory: (config: ConfigService) => createStorageProvider(config) }],
  exports: [StorageService],
})
export class StorageModule implements OnModuleInit, OnModuleDestroy {
  private sweeper?: NodeJS.Timeout;
  private unusedSweeper?: NodeJS.Timeout;

  constructor(private readonly storage: StorageService) {}

  /** Clear temp files a previous process left behind and direct uploads nobody finished, then keep sweeping hourly. */
  onModuleInit() {
    const log = new Logger("Storage");
    const sweep = () => {
      void sweepStaleTemps().then((n) => n && log.log(`Removed ${n} stale upload temp file(s).`));
      void this.storage
        .sweepAbandonedDirectUploads()
        .then((n) => n && log.log(`Removed ${n} abandoned direct upload(s).`))
        .catch((err: Error) => log.warn(`Abandoned-upload sweep failed: ${err.message}`));
    };
    // Files nothing uses any more. Not at start-up (the modules that say what is in use are still
    // registering), and it does nothing unless DATA_DELETION_MODE allows it.
    const sweepUnused = () =>
      void this.storage
        .sweepUnreferenced()
        .then((r) => r.deleted && log.log(`Removed ${r.deleted} stored file(s) that nothing uses any more.`))
        .catch((err: Error) => log.warn(`Unused-file sweep failed: ${err.message}`));
    sweep();
    this.unusedSweeper = setInterval(sweepUnused, 60 * 60 * 1000);
    this.unusedSweeper.unref();
    this.sweeper = setInterval(sweep, 60 * 60 * 1000);
    this.sweeper.unref();
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
    clearInterval(this.unusedSweeper);
  }
}
