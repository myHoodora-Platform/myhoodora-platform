import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { AllowedText } from "../moderation/allowed-text.decorator";
import { CONTENT_TAGS, TEAM_CATEGORIES, type ContentTag, type TeamCategory } from "./domain/content-bank";
import { SCHEDULED_STATUSES, SCHEDULE_SOURCES, type ScheduleSource, type ScheduledStatus } from "./hood-content.schemas";

class CityVariantDto {
  @IsString() @Length(1, 60) city!: string;
  @AllowedText() @IsString() @Length(1, 2000) body!: string;
}

/** POST /admin/hood-content/items and PATCH /admin/hood-content/items/:id (PATCH sends only what changes). */
export class ContentItemDto {
  @IsOptional() @Matches(/^[A-Z]{1,3}\d{2,3}$/, { message: "Codes look like S12 or FX101." }) code?: string;
  @IsOptional() @IsIn(CONTENT_TAGS) tag?: ContentTag;
  @IsOptional() @IsIn(TEAM_CATEGORIES) category?: TeamCategory;
  @IsOptional() @AllowedText() @IsString() @Length(1, 2000) body?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @AllowedText() @IsString({ each: true }) @Length(1, 60, { each: true }) pollOptions?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) pollDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) pinDays?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CityVariantDto) cityVariants?: CityVariantDto[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ItemListQuery {
  @IsOptional() @IsIn(CONTENT_TAGS) tag?: ContentTag;
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsIn(["true", "false"]) active?: "true" | "false";
}

/** POST /admin/hood-content/items/import: the content bank markdown file. */
export class ImportDto {
  @IsString() @Length(1, 400_000) markdown!: string;
  /** Replace the text of items that already exist (otherwise only new codes are added). */
  @IsOptional() @IsBoolean() overwrite?: boolean;
}

/** Which Hoods: chosen ones, every open Hood in some cities, or every open Hood. */
export class HoodTargetDto {
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsMongoId({ each: true }) hoodIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @Length(1, 60, { each: true }) cities?: string[];
  @IsOptional() @IsBoolean() allHoods?: boolean;
}

/** POST /admin/hood-content/compose: post now or later, as the Hood Team, in the chosen Hoods. */
export class ComposeDto extends HoodTargetDto {
  /** Start from a bank item (its text is used unless `message` is given). */
  @IsOptional() @IsMongoId() itemId?: string;
  /** `{hood}` and `{city}` are filled in per Hood. */
  @IsOptional() @AllowedText() @IsString() @Length(1, 8192) message?: string;
  @IsOptional() @IsIn(TEAM_CATEGORIES) category?: TeamCategory;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4) @AllowedText() @IsString({ each: true }) @Length(1, 60, { each: true }) pollOptions?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) pollDays?: number;
  @IsOptional() @IsDateString() eventDate?: string;
  @IsOptional() @AllowedText() @IsString() @MaxLength(200) eventLocation?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) pinDays?: number;
  /** Later; omitted = now. */
  @IsOptional() @IsDateString() runAt?: string;
}

/** POST /admin/hood-content/activation: schedule the first-ten-days plan. */
export class ActivationDto extends HoodTargetDto {
  /** Lagos date of day 0 (YYYY-MM-DD); omitted = today. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  /** Hoods that already have this many posts (any author) are left alone. Default 15. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) skipIfPostsAtLeast?: number;
}

export class ScheduledListQuery {
  @IsOptional() @IsIn(SCHEDULED_STATUSES) status?: ScheduledStatus;
  @IsOptional() @IsIn(SCHEDULE_SOURCES) source?: ScheduleSource;
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsString() @Length(1, 60) batchId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class DailySettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(23) hour?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) minNeighbours?: number;
}

/** PUT /admin/hood-content/daily/calendar/:date — choose the item for one day (null = rotate). */
export class CalendarDayDto {
  @IsOptional() @Matches(/^[A-Z]{1,3}\d{2,3}$/) code?: string | null;
}

/** PATCH /admin/hood-content/posts/:id/pin — days from now, or 0 to unpin. */
export class PinDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(30) days!: number;
}
