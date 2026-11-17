import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from "class-validator";

/** PATCH /admin/engagement */
export class EngagementSettingsDto {
  @IsOptional() @IsString() @Length(3, 80) challengeName?: string;
  @IsOptional() @IsDateString() challengeStartsAt?: string;
  /** null reopens the challenge. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() challengeEndsAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) minInvites?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) minActiveDays?: number;
  @IsOptional() @IsBoolean() streaksOn?: boolean;
  @IsOptional() @IsBoolean() badgesOn?: boolean;
}

/** PUT /admin/engagement/builders/:uid */
export class SetBuilderDto {
  @IsBoolean() on!: boolean;
  @IsString() @Length(3, 300) reason!: string;
}

export class BuildersQuery {
  @IsOptional() @IsIn(["json", "csv"]) format?: "json" | "csv";
}
