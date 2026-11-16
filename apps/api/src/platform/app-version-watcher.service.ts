import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { advanceRule } from "./app-version-rules";
import { APP_PLATFORMS, type AppPlatform, type AppStoreStatus, type AppUpdates } from "./platform-settings.schema";
import { PlatformSettingsService } from "./platform-settings.service";
import type { StoreVersionSource } from "./store-versions";

export const STORE_VERSION_SOURCES = Symbol("STORE_VERSION_SOURCES");

const FIRST_RUN_MS = 60_000;
const EVERY_MS = 6 * 60 * 60 * 1000;
const PLATFORM_NAMES: Record<AppPlatform, string> = { android: "Android", ios: "iPhone" };
const SYSTEM_ACTOR = { uid: "system:store-check", displayName: "Store check", role: "system" } as unknown as Parameters<AuditService["record"]>[0];

/**
 * Keeps the app's update prompts current without anyone remembering to: Latest rises to what each store
 * has live, and Minimum follows Latest after the admin-set days (app-version-rules.ts). Every change is
 * audited as `settings_update` by "Store check". Several API instances may run it: each pass only moves
 * versions forward, so running twice is harmless.
 */
@Injectable()
export class AppVersionWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppVersionWatcherService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    @Inject(STORE_VERSION_SOURCES) private readonly sources: StoreVersionSource[],
    private readonly settings: PlatformSettingsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.get<boolean>("appUpdates.watch")) return;
    const run = () => void this.check().catch((err) => this.logger.warn(`Store check failed: ${(err as Error).message}`));
    const first = setTimeout(run, FIRST_RUN_MS);
    const every = setInterval(run, EVERY_MS);
    first.unref();
    every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  /** One pass over both stores. Public for "Check the stores now" and tests. */
  async check(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const current = await this.settings.get();
      const status = { ...current.appStoreStatus };
      const appUpdates = { ...current.appUpdates } as AppUpdates;
      for (const platform of APP_PLATFORMS) {
        const source = this.sources.find((s) => s.platform === platform);
        const seen: AppStoreStatus = source
          ? await source.check().then(
              (r) => ({ ...r, checkedAt: now }),
              (err: unknown) => ({ ...status[platform], checkedAt: now, problem: (err as Error).message || "The store couldn't be reached" }),
            )
          : { version: null, url: null, checkedAt: now, problem: "No store check for this platform" };
        status[platform] = seen;
        const { rule, changes } = advanceRule(appUpdates[platform], seen.problem ? { version: seen.version, url: seen.url } : seen, current.appUpdatesAuto, now);
        appUpdates[platform] = rule;
        for (const c of changes) {
          const label = `App updates: ${PLATFORM_NAMES[platform]} ${c.field === "storeUrl" ? "store page" : c.field} ${c.from || "(none)"} → ${c.to}`;
          await this.audit.record(SYSTEM_ACTOR, "settings_update", { type: "settings", id: "platform", label });
          this.logger.log(label);
        }
      }
      await this.settings.saveStoreCheck(appUpdates, status);
    } finally {
      this.running = false;
    }
  }
}
