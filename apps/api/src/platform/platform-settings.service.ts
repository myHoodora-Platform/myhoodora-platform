import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ALERT_CATEGORIES, DEFAULT_ALERT_WINDOWS, DEFAULT_REPORT_REASONS, PlatformSettings, PlatformSettingsDocument, type AlertCategory, type ReportReasonSetting } from "./platform-settings.schema";

export interface SettingsView {
  alertWindows: Record<AlertCategory, number>;
  reportReasons: ReportReasonSetting[];
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
    };
    this.cache = { at: Date.now(), value };
    return value;
  }

  async update(patch: { alertWindows?: Partial<Record<AlertCategory, number>>; reportReasons?: Pick<ReportReasonSetting, "id" | "severity" | "staffOnly">[] }): Promise<SettingsView> {
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
    await this.settings.updateOne({ key: "platform" }, { $set: { alertWindows, reportReasons } }, { upsert: true }).exec();
    this.cache = null;
    return this.get();
  }
}
