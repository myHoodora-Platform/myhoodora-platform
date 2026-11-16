import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const ALERT_CATEGORIES = ["security", "power", "water", "flooding", "traffic", "fire", "scam", "other"] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const REPORT_REASONS = ["spam", "harassment", "child_safety", "misinformation", "scam", "not_local", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type Severity = "high" | "medium" | "low";

export interface ReportReasonSetting {
  id: ReportReason;
  label: string;
  severity: Severity;
  /** Skips volunteer Hood Leads and goes straight to staff (Nextdoor model). */
  staffOnly: boolean;
}

/** Contract §1 alert windows (hours). Admin-editable. */
export const DEFAULT_ALERT_WINDOWS: Record<AlertCategory, number> = { traffic: 3, fire: 6, security: 12, power: 12, flooding: 24, water: 24, other: 24, scam: 168 };
export const URGENT_WINDOW_HOURS = 2;

export const DEFAULT_REPORT_REASONS: ReportReasonSetting[] = [
  // Child sexual abuse or exploitation: never shown to volunteer Leads (web /child-safety).
  { id: "child_safety", label: "Child safety", severity: "high", staffOnly: true },
  { id: "harassment", label: "Harassment or hate", severity: "high", staffOnly: true },
  { id: "scam", label: "Scam or fraud", severity: "high", staffOnly: true },
  { id: "misinformation", label: "Misinformation", severity: "high", staffOnly: true },
  { id: "other", label: "Something else", severity: "medium", staffOnly: false },
  { id: "spam", label: "Spam or advertising", severity: "low", staffOnly: false },
  { id: "not_local", label: "Not about the neighbourhood", severity: "low", staffOnly: false },
];

/**
 * Days before the app asks again someone who said no to usage analytics (apps/mobile core/analytics).
 * 0 never asks again. Six months is the benchmark European regulators use for asking again after a refusal.
 */
export const DEFAULT_ANALYTICS_REASK_DAYS = 180;
export const MAX_ANALYTICS_REASK_DAYS = 730;

/**
 * Where "myHoodora AI" links go (web footer, the /ai address, the app's menu): our own /ai page, or the
 * separate AI Studio site. Admins switch between them in Admin → Settings → Platform.
 */
export const HOODORA_AI_TARGETS = ["page", "studio"] as const;
export type HoodoraAiTarget = (typeof HOODORA_AI_TARGETS)[number];
export interface HoodoraAiLink {
  target: HoodoraAiTarget;
  studioUrl: string;
}
export const DEFAULT_HOODORA_AI: HoodoraAiLink = { target: "studio", studioUrl: "https://studio.myhoodora.com/" };

/**
 * Store versions the app compares itself with (GET /app-config → updates): below `minimum` it blocks
 * with "Update required", below `latest` it offers the update once in a while. `storeUrl` empty: the
 * app isn't in that store yet, so nobody there is prompted.
 */
export const APP_PLATFORMS = ["android", "ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];
export interface AppVersionRule {
  latest: string;
  minimum: string;
  storeUrl: string;
}
export type AppUpdates = Record<AppPlatform, AppVersionRule>;
export const APP_VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const DEFAULT_APP_UPDATES: AppUpdates = {
  android: { latest: "1.0.0", minimum: "1.0.0", storeUrl: "https://play.google.com/store/apps/details?id=com.myhoodora.app" },
  ios: { latest: "1.0.0", minimum: "1.0.0", storeUrl: "" },
};

/** Same rule as packages/api-contract compareVersions (the API doesn't import the contract package). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

/** Singleton document (key = "platform"). */
@Schema({ timestamps: true, collection: "platform_settings" })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: "platform" })
  key!: string;

  @Prop({ type: Object, default: () => ({ ...DEFAULT_ALERT_WINDOWS }) })
  alertWindows!: Record<AlertCategory, number>;

  @Prop({ type: [Object], default: () => DEFAULT_REPORT_REASONS.map((r) => ({ ...r })) })
  reportReasons!: ReportReasonSetting[];

  @Prop({ type: Number, default: DEFAULT_ANALYTICS_REASK_DAYS })
  analyticsReaskDays!: number;

  @Prop({ type: Object, default: () => ({ ...DEFAULT_HOODORA_AI }) })
  hoodoraAi!: HoodoraAiLink;

  @Prop({ type: Object, default: () => structuredClone(DEFAULT_APP_UPDATES) })
  appUpdates!: AppUpdates;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
