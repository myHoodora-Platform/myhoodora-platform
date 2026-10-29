import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { COMMENT_MODES, PROMPT_ACCENTS, PROMPT_KINDS, PROMPT_LAYOUTS, PROMPT_STATUSES, SIGNAL_KEYS, TRIGGER_TYPES, type CommentMode, type PromptKind, type PromptLayout, type PromptStatus, type SignalKey, type TriggerType } from "./prompt.schema";

class PromptOptionDto {
  @Matches(/^[a-z0-9_-]{1,20}$/, { message: "Option ids are 1–20 of a–z, 0–9, - and _." }) id!: string;
  @IsString() @Length(1, 60) label!: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
}

/** POST /admin/prompts and PATCH /admin/prompts/:id (PATCH sends only what changes). */
export class PromptInputDto {
  @IsOptional() @IsString() @Length(1, 80) title?: string;
  @IsOptional() @IsIn(PROMPT_KINDS) kind?: PromptKind;
  @IsOptional() @IsString() @Length(1, 140) question?: string;
  @IsOptional() @IsString() @MaxLength(240) detail?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => PromptOptionDto) options?: PromptOptionDto[];
  @IsOptional() @IsIn(COMMENT_MODES) commentMode?: CommentMode;
  @IsOptional() @IsString() @MaxLength(80) commentLabel?: string;
  @IsOptional() @IsString() @MaxLength(140) thanksMessage?: string;
  @IsOptional() @IsIn(PROMPT_LAYOUTS) layout?: PromptLayout;
  @IsOptional() @IsIn(PROMPT_ACCENTS) accent?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsIn(TRIGGER_TYPES) triggerType?: TriggerType;
  @IsOptional() @IsIn(SIGNAL_KEYS) triggerKey?: SignalKey;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) triggerCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30) delaySeconds?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsMongoId({ each: true }) hoodIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @Length(1, 60, { each: true }) cities?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) minDaysSinceJoin?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) maxDaysSinceJoin?: number | null;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) priority?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) maxShows?: number;
  @IsOptional() @IsBoolean() push?: boolean;
}

export class PromptStatusDto {
  @IsIn(PROMPT_STATUSES) status!: PromptStatus;
}

export class PromptListQuery {
  @IsOptional() @IsIn(PROMPT_STATUSES) status?: PromptStatus;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class MilestoneDto {
  @IsIn(SIGNAL_KEYS) key!: SignalKey;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) count!: number;
}

/** PATCH /admin/prompts/settings */
export class PromptSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(180) cooldownDays?: number;
  @IsOptional() @IsBoolean() storeReviewEnabled?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => MilestoneDto) storeReviewMilestones?: MilestoneDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) storeReviewMinDaysSinceJoin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(30) @Max(730) storeReviewCooldownDays?: number;
}

/** POST /engagement/signal: something the neighbour just did (or the app opening). */
export class SignalDto {
  @IsIn(SIGNAL_KEYS) key!: SignalKey;
  /** What it was about (the post, listing, event…), kept with an answer. */
  @IsOptional() @IsString() @MaxLength(64) subjectId?: string;
}

/** POST /prompts/:id/respond */
export class RespondDto {
  /** stars 1–5, nps 0–10, thumbs 1 (up) or 0 (down). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) value?: number;
  @IsOptional() @IsString() @MaxLength(20) optionId?: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsIn(SIGNAL_KEYS) contextKey?: SignalKey;
  @IsOptional() @IsString() @MaxLength(64) subjectId?: string;
  @IsOptional() @IsIn(["ios", "android", "web"]) platform?: "ios" | "android" | "web";
}
