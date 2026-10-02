import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ALERT_CATEGORIES, REPORT_REASONS } from "../platform/platform-settings.schema";
import { POST_CATEGORIES } from "../posts/domain/post-meta";
import { ACCOUNT_STATUSES, ROLES, VERIFICATION_STATUSES } from "../shared/authz/roles";
import { PageQuery } from "../shared/http/pagination";
import { HOOD_STATUSES } from "../hoods/schemas/hood.schema";
import { TARGET_TYPES } from "../moderation/moderation-registry";
import { CASE_STATUSES, MODERATION_ACTIONS } from "../moderation/moderation.schemas";

const boolean = ({ value }: { value: unknown }) => value === true || value === "true";

export class AdminReportQuery extends PageQuery {
  @IsOptional() @IsIn([...CASE_STATUSES, "active", "all"]) status?: (typeof CASE_STATUSES)[number] | "active" | "all";
  @IsOptional() @IsIn(TARGET_TYPES) type?: (typeof TARGET_TYPES)[number];
  @IsOptional() @IsIn(REPORT_REASONS) reason?: (typeof REPORT_REASONS)[number];
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsString() @MaxLength(128) authorUid?: string;
  @IsOptional() @IsIn(["high", "medium", "low"]) severity?: "high" | "medium" | "low";
}

export class DecisionDto {
  @IsIn(MODERATION_ACTIONS) action!: (typeof MODERATION_ACTIONS)[number];
  @IsString() @Length(2, 200) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsInt() @Min(1) @Max(30) restrictDays?: number;
}

export class AuditQueryDto extends PageQuery {
  @IsOptional() @IsString() @MaxLength(128) actorUid?: string;
  @IsOptional() @IsString() @MaxLength(40) action?: string;
  @IsOptional() @IsString() @MaxLength(40) targetType?: string;
}

export class NeighbourQueryDto extends PageQuery {
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsIn(VERIFICATION_STATUSES) verification?: (typeof VERIFICATION_STATUSES)[number];
  @IsOptional() @IsIn(ACCOUNT_STATUSES) account?: (typeof ACCOUNT_STATUSES)[number];
  @IsOptional() @IsIn(ROLES) role?: (typeof ROLES)[number];
}

const NEIGHBOUR_ACTIONS = ["verify", "reject_verification", "change_hood", "warn", "restrict", "suspend", "reinstate"] as const;

export class NeighbourActionDto {
  @IsIn(NEIGHBOUR_ACTIONS) action!: (typeof NEIGHBOUR_ACTIONS)[number];
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(30) days?: number;
  @IsString() @Length(2, 200) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BulkNeighbourDto extends NeighbourActionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) uids!: string[];
}

export class VerificationQueryDto extends PageQuery {
  @IsOptional() @IsIn(["pending_review", "failed"]) status?: "pending_review" | "failed";
}

export class HoodQueryDto extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsIn(HOOD_STATUSES) status?: (typeof HOOD_STATUSES)[number];
}

export class AdminPostQuery extends PageQuery {
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsIn(POST_CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(128) authorUid?: string;
  @IsOptional() @IsIn(["visible", "removed"]) status?: "visible" | "removed";
  @IsOptional() @Type(() => String) @IsIn(["true", "false"]) reported?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ContentActionDto {
  @IsIn(["remove", "restore"]) action!: "remove" | "restore";
  @IsString() @Length(2, 200) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AlertQueryDto extends PageQuery {
  @IsOptional() @IsIn(["live", "urgent", "active", "resolved", "ended"]) level?: "live" | "urgent" | "active" | "resolved" | "ended";
  @IsOptional() @IsMongoId() hoodId?: string;
}

export class AlertActionDto {
  @IsIn(["end", "downgrade", "remove"]) action!: "end" | "downgrade" | "remove";
  @IsString() @Length(2, 200) reason!: string;
}

export class TeamRoleDto {
  @IsIn(ROLES) role!: (typeof ROLES)[number];
}

class ReasonSettingDto {
  @IsIn(REPORT_REASONS) id!: (typeof REPORT_REASONS)[number];
  /** Sent back by the web form; labels are fixed server-side and ignored. */
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsIn(["high", "medium", "low"]) severity!: "high" | "medium" | "low";
  @IsBoolean() staffOnly!: boolean;
}

export class SettingsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReasonSettingDto)
  reportReasons?: ReasonSettingDto[];

  /** Hours per alert category (editable alert windows). */
  @IsOptional()
  alertWindows?: Partial<Record<(typeof ALERT_CATEGORIES)[number], number>>;

  /** Read-only (derived from Hoods); accepted so the web can send the whole object back, then ignored. */
  @IsOptional()
  @IsArray()
  coverageCities?: unknown[];
}

class AudienceDto {
  @IsIn(["all", "hood", "user"]) type!: "all" | "hood" | "user";
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsMongoId({ each: true }) hoodIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) uids?: string[];
}

export class BroadcastDto {
  @IsString() @Length(3, 60) title!: string;
  @IsString() @Length(10, 240) body!: string;
  @ValidateNested() @Type(() => AudienceDto) audience!: AudienceDto;
}

export class EstimateDto {
  @ValidateNested() @Type(() => AudienceDto) audience!: AudienceDto;
}

export { boolean };

export class AdminListingQuery extends PageQuery {
  @IsOptional() @IsIn(["active", "sold", "removed"]) status?: "active" | "sold" | "removed";
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @Type(() => String) @IsIn(["true", "false"]) reported?: string;
}

export class AdminGroupQuery extends PageQuery {
  @IsOptional() @IsIn(["active", "archived"]) status?: "active" | "archived";
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @IsIn(["open", "private"]) privacy?: "open" | "private";
  @IsOptional() @Type(() => String) @IsIn(["true", "false"]) reported?: string;
}

export class AppealQuery extends PageQuery {
  @IsOptional() @IsIn(["open", "upheld", "overturned"]) status?: "open" | "upheld" | "overturned";
}

export class AppealDecisionDto {
  @IsIn(["upheld", "overturned"]) outcome!: "upheld" | "overturned";
  /** Shown to the person who appealed. */
  @IsString() @Length(5, 500) reason!: string;
}

export class HoodLeadsDto {
  @IsArray() @ArrayMaxSize(15) @IsString({ each: true }) uids!: string[];
}
