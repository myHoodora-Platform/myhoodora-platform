import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DEFAULT_APP_UPDATES_AUTO, type AppUpdatesAuto } from "./app-version-rules";
import { ALERT_CATEGORIES, APP_PLATFORMS, DEFAULT_ALERT_WINDOWS, DEFAULT_ANALYTICS_REASK_DAYS, DEFAULT_APP_UPDATES, DEFAULT_HOODORA_AI, DEFAULT_REPORT_REASONS, PlatformSettings, PlatformSettingsDocument, type AlertCategory, type AppPlatform, type AppStoreStatus, type AppUpdates, type HoodoraAiLink, type ReportReasonSetting } from "./platform-settings.schema";

export interface SettingsView {
  alertWindows: Record<AlertCategory, number>;
  reportReasons: ReportReasonSetting[];
  analyticsReaskDays: number;
  hoodoraAi: HoodoraAiLink;
  appUpdates: AppUpdates;
  appUpdatesAuto: AppUpdatesAuto;
  /** Read-only: the last store check per platform. */
  appStoreStatus: Record<AppPlatform, AppStoreStatus>;
}

const NO_CHECK: AppStoreStatus = { version: null, url: null, checkedAt: null, problem: null };

/** Stored values over the defaults, platform by platform (a document from before this setting has none). */
function withDefaults(stored: Partial<Record<keyof AppUpdates, Partial<AppUpdates[keyof AppUpdates]>>> | undefined): AppUpdates {
  const out = structuredClone(DEFAULT_APP_UPDATES);
  for (const p of APP_PLATFORMS) out[p] = { ...out[p], ...(stored?.[p] ?? {}) };
  return out;
}

/** Admin-tunable platform rules, cached briefly (they change rarely). */
@Injectable()
export class PlatformSettingsService {
  private cache: { at: number; value: SettingsView } | null = null;

  constructor(@InjectModel(PlatformSettings.name) private readonly settings: Model<PlatformSettingsDocument>) {}

  async get(): Promise<SettingsView> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    const doc = await this.settings.findOne({ key: "platform" }).lean<PlatformSettings>().exec();
    const value: SettingsView = {
      alertWindows: { ...DEFAULT_ALERT_WINDOWS, ...(doc?.alertWindows ?? {}) },
      reportReasons: DEFAULT_REPORT_REASONS.map((d) => ({ ...d, ...(doc?.reportReasons?.find((r) => r.id === d.id) ?? {}), id: d.id })),
      analyticsReaskDays: doc?.analyticsReaskDays ?? DEFAULT_ANALYTICS_REASK_DAYS,
      hoodoraAi: { ...DEFAULT_HOODORA_AI, ...(doc?.hoodoraAi ?? {}) },
      appUpdates: withDefaults(doc?.appUpdates),
      appUpdatesAuto: { ...DEFAULT_APP_UPDATES_AUTO, ...(doc?.appUpdatesAuto ?? {}) },
      appStoreStatus: { android: { ...NO_CHECK, ...(doc?.appStoreStatus?.android ?? {}) }, ios: { ...NO_CHECK, ...(doc?.appStoreStatus?.ios ?? {}) } },
    };
    this.cache = { at: Date.now(), value };
    return value;
  }

  async update(patch: { alertWindows?: Partial<Record<AlertCategory, number>>; reportReasons?: Pick<ReportReasonSetting, "id" | "severity" | "staffOnly">[]; analyticsReaskDays?: number; hoodoraAi?: HoodoraAiLink; appUpdates?: Record<AppPlatform, { latest: string; minimum: string; storeUrl: string }>; appUpdatesAuto?: AppUpdatesAuto }): Promise<SettingsView> {
    const current = await this.get();
    const alertWindows = { ...current.alertWindows };
    for (const k of ALERT_CATEGORIES) {
      const v = patch.alertWindows?.[k];
      if (typeof v === "number") alertWindows[k] = v;
    }
    const reportReasons = current.reportReasons.map((r) => {
      const p = patch.reportReasons?.find((x) => x.id === r.id);
      return p ? { ...r, severity: p.severity, staffOnly: p.staffOnly } : r;
    });
    const analyticsReaskDays = patch.analyticsReaskDays ?? current.analyticsReaskDays;
    const hoodoraAi = patch.hoodoraAi ? { target: patch.hoodoraAi.target, studioUrl: patch.hoodoraAi.studioUrl } : current.hoodoraAi;
    // A Latest changed by hand restarts the clock for Minimum to follow it.
    const appUpdates = patch.appUpdates
      ? (Object.fromEntries(
          APP_PLATFORMS.map((p) => {
            const { latest, minimum, storeUrl } = patch.appUpdates![p];
            const was = current.appUpdates[p];
            return [p, { latest, minimum, storeUrl, latestSince: latest !== was.latest ? new Date() : (was.latestSince ?? null) }];
          }),
        ) as AppUpdates)
      : current.appUpdates;
    const appUpdatesAuto = patch.appUpdatesAuto ? { fromStores: patch.appUpdatesAuto.fromStores, requireAfterDays: patch.appUpdatesAuto.requireAfterDays } : current.appUpdatesAuto;
    await this.settings.updateOne({ key: "platform" }, { $set: { alertWindows, reportReasons, analyticsReaskDays, hoodoraAi, appUpdates, appUpdatesAuto } }, { upsert: true }).exec();
    this.cache = null;
    return this.get();
  }

  /** The store watcher's write: versions it moved and what each store showed (app-version-watcher.service.ts). */
  async saveStoreCheck(appUpdates: AppUpdates, appStoreStatus: Record<AppPlatform, AppStoreStatus>): Promise<void> {
    await this.settings.updateOne({ key: "platform" }, { $set: { appUpdates, appStoreStatus } }, { upsert: true }).exec();
    this.cache = null;
  }
}
