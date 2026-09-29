import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Length, MaxLength, Min, Max, ValidateIf } from "class-validator";
import { LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_STATUSES, type ListingCategory, type ListingStatus } from "./listing.schema";

export class CreateListingDto {
  /** Must be your own Hood if sent. */
  @IsOptional() @IsMongoId() neighborhoodId?: string;
  @IsString() @Length(3, 80) title!: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
  /** Naira, whole numbers; null = free. */
  @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(1_000_000_000) priceNaira!: number | null;
  @IsOptional() @IsBoolean() negotiable?: boolean;
  @IsIn(LISTING_CATEGORIES) category!: ListingCategory;
  @IsIn(LISTING_CONDITIONS) condition!: (typeof LISTING_CONDITIONS)[number];
  @IsArray() @ArrayMaxSize(10) @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true }) photos!: string[];
}

export class UpdateListingDto {
  @IsIn(LISTING_STATUSES) status!: ListingStatus;
}

export class ListingQuery {
  @IsOptional() @IsMongoId() neighborhoodId?: string;
  @IsOptional() @IsIn(LISTING_CATEGORIES) category?: ListingCategory;
  @ApiPropertyOptional({ description: "Only free items" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  free?: boolean;
  /** Seller uid */
  @IsOptional() @IsString() @MaxLength(128) seller?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
