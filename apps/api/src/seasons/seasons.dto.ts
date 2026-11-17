import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, ValidateIf } from "class-validator";
import { SEASON_ACCENTS, SEASON_EFFECTS, SEASON_INTENSITIES, SEASON_MASCOTS, type SeasonAccent, type SeasonEffect, type SeasonIntensity, type SeasonMascot } from "./seasons-rules";

/** POST /admin/seasons and PATCH /admin/seasons/:id (PATCH sends what changes). */
export class SeasonInputDto {
  @IsOptional() @Matches(/^[a-z0-9-]{3,40}$/, { message: "Use lowercase letters, numbers and dashes, like christmas-2026." }) key?: string;
  @IsOptional() @IsString() @Length(2, 60) label?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsIn(SEASON_EFFECTS) effect?: SeasonEffect;
  @IsOptional() @IsIn(SEASON_INTENSITIES) intensity?: SeasonIntensity;
  @IsOptional() @IsIn(SEASON_MASCOTS) mascot?: SeasonMascot;
  @IsOptional() @IsIn(SEASON_ACCENTS) accent?: SeasonAccent;
  @IsOptional() @IsString() @MaxLength(80) greetingTitle?: string;
  @IsOptional() @IsString() @MaxLength(280) greetingBody?: string;
  /** null removes it. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUrl({ protocols: ["https"], require_protocol: true }) imageUrl?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(120) imageCredit?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() countdownTo?: string | null;
}
