import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ALERT_CATEGORIES } from "../../platform/platform-settings.schema";
import { POST_CATEGORIES, POST_VISIBILITIES, type PostCategory, type PostVisibility } from "../domain/post-meta";
import { REACTION_TYPES, type ReactionType } from "../schemas/post.schema";
import { CursorQuery } from "../../shared/http/pagination";

class PollOptionDto {
  @IsString()
  @Length(1, 20)
  id!: string;

  @IsString()
  @Length(1, 60)
  text!: string;
}

class PollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options!: PollOptionDto[];

  @IsISO8601()
  closesAt!: string;
}

class PointDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

/**
 * POST /posts. Accepts the current web payload (`content` with an encoded
 * meta prefix) and the first-class fields (contract §1). `neighborhoodId`
 * is optional and must match the caller's own Hood if sent.
 */
export class CreatePostDto {
  @IsOptional() @IsMongoId() neighborhoodId?: string;

  /** Legacy: message with optional `<!--mh:{…}-->` prefix. */
  @IsOptional() @IsString() @Length(1, 9000) content?: string;

  @IsOptional() @IsString() @Length(1, 8192) message?: string;

  @IsOptional() @IsIn(["text", "image", "event", "alert"]) type?: "text" | "image" | "event" | "alert";
  @IsOptional() @IsIn(POST_CATEGORIES) category?: PostCategory;
  @IsOptional() @IsIn(ALERT_CATEGORIES) alertCategory?: string;
  @IsOptional() @IsBoolean() urgent?: boolean;
  @IsOptional() @IsDateString() eventDate?: string;
  @IsOptional() @IsString() @MaxLength(200) eventLocation?: string;
  @IsOptional() @IsString() @MaxLength(80) thankedName?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) priceNaira?: number | null;
  @IsOptional() @ValidateNested() @Type(() => PollDto) poll?: PollDto;
  @IsOptional() @IsIn(POST_VISIBILITIES) visibility?: PostVisibility;
  @IsOptional() @ValidateNested() @Type(() => PointDto) location?: PointDto;

  /** Nextdoor caps media at 10. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  mediaUrls?: string[];
}

export class FeedQuery extends CursorQuery {
  @IsOptional() @IsIn(POST_CATEGORIES) category?: PostCategory;
  /** e.g. alerts from the last 7 days */
  @IsOptional() @IsDateString() since?: string;
}

export class ReactionDto {
  @IsIn(REACTION_TYPES) type!: ReactionType;
}

export class VoteDto {
  @IsString() @Length(1, 20) optionId!: string;
}

export class RsvpDto {
  @IsIn(["going", "interested"]) status!: "going" | "interested";
}

export class ResolveAlertDto {
  @IsBoolean() resolved!: boolean;
}
