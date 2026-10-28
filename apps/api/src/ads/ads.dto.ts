import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { POST_CATEGORIES, type PostCategory } from "../posts/domain/post-meta";
import { REPORT_REASONS } from "../platform/platform-settings.schema";
import { AD_BACKGROUNDS, AD_CTAS, AD_FORMATS, AD_STATUSES, AD_TRACKED_TYPES, type AdTrackedType, type AdBackground, type AdCta, type AdFormat, type AdStatus } from "./ad.schema";

const HTTPS = { protocols: ["https"], require_protocol: true };
/** A feed session id the app makes up when the feed opens or refreshes. */
const SESSION = /^[A-Za-z0-9_-]{8,64}$/;

class AdMediaDto {
  @IsUrl(HTTPS) url!: string;
  @IsIn(["image", "video"]) kind!: "image" | "video";
  /** Videos: the still shown before it plays. */
  @IsOptional() @IsUrl(HTTPS) posterUrl?: string;
}

class NearDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(50) radiusKm!: number;
  /** What the place is called ("Opebi"), for staff and for "Why am I seeing this?". */
  @IsOptional() @IsString() @MaxLength(80) label?: string;
}

class AdCardDto {
  @IsUrl(HTTPS) imageUrl!: string;
  @IsString() @Length(1, 40) headline!: string;
  @IsUrl(HTTPS) url!: string;
}

/** POST /admin/ads and PATCH /admin/ads/:id (PATCH sends only what changes). The format decides what's required. */
export class AdInputDto {
  @IsOptional() @IsString() @Length(1, 80) title?: string;
  @IsOptional() @IsString() @Length(1, 60) advertiserName?: string;
  @IsOptional() @IsUrl(HTTPS) advertiserLogoUrl?: string;
  @IsOptional() @IsIn(AD_FORMATS) format?: AdFormat;
  @IsOptional() @IsString() @MaxLength(500) primaryText?: string;
  @IsOptional() @IsString() @MaxLength(60) headline?: string;
  @IsOptional() @IsIn(AD_CTAS) ctaType?: AdCta;
  @IsOptional() @IsUrl(HTTPS) ctaUrl?: string;
  /** Nigerian or international number, digits with an optional leading +. */
  @IsOptional() @Matches(/^\+?[0-9]{7,15}$/, { message: "Use a phone number, digits only (with + for international)." }) ctaPhone?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(1) @ValidateNested({ each: true }) @Type(() => AdMediaDto) media?: AdMediaDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AdCardDto) cards?: AdCardDto[];
  @IsOptional() @IsIn(AD_BACKGROUNDS) background?: AdBackground;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) priority?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) dailyCapPerUser?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsMongoId({ each: true }) hoodIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @Length(1, 60, { each: true }) cities?: string[];
  /** Neighbourhoods near a place; null clears it. */
  @IsOptional() @ValidateNested() @Type(() => NearDto) near?: NearDto | null;
}

/** Draft, live, paused or ended. */
export class AdStatusDto {
  @IsIn(AD_STATUSES) status!: AdStatus;
}

export class AdListQuery {
  @IsOptional() @IsIn(AD_STATUSES) status?: AdStatus;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export class AdStatsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

/** PATCH /admin/ads/settings: the placement rules. */
export class AdSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) firstAfter?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(30) minGap?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(30) maxGap?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) minOrganic?: number;
}

/** GET /feed/hood/:id: a page of posts with sponsored items placed among them. */
export class AdFeedQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit = 10;
  /** The previous page's `nextCursor`, as given. */
  @IsOptional() @IsString() @MaxLength(4000) cursor?: string;
  @IsOptional() @IsIn(POST_CATEGORIES) category?: PostCategory;
  /** Made up by the app each time the feed opens or is refreshed. */
  @Matches(SESSION, { message: "session must be 8–64 letters, digits, - or _." }) session!: string;
}

class AdEventDto {
  @IsMongoId() adId!: string;
  /** impression · click · video_play (started playing) · unmute (sound on) · swipe (carousel) · why ("Why am I seeing this?") */
  @IsIn(AD_TRACKED_TYPES) type!: AdTrackedType;
  @Matches(SESSION) sessionId!: string;
}

/** POST /ads/events: a batch, sent when convenient. */
export class AdEventsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AdEventDto) events!: AdEventDto[];
}

export class HideAdDto {
  @IsOptional() @Matches(SESSION) sessionId?: string;
}

export class ReportAdDto {
  @IsIn(REPORT_REASONS) reason!: (typeof REPORT_REASONS)[number];
  @IsOptional() @Matches(SESSION) sessionId?: string;
}
