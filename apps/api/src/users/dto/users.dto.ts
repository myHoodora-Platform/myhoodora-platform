import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsLatitude, IsLongitude, IsMongoId, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf, ValidateNested } from "class-validator";

/** PATCH /users/me — profile fields only. `neighborhoodId` is NOT accepted (security: Hood changes go through verification or staff). */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  /** An https URL (from POST /media), or null to remove the photo. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  photoURL?: string | null;
}

class OnboardingLocationDto {
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class OnboardingDto {
  /**
   * Name neighbours see.
   * @example Ada Okafor
   */
  @IsOptional()
  @IsString()
  @Length(2, 60)
  displayName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingLocationDto)
  location?: OnboardingLocationDto;
}

export class VerifyLocationDto {
  /**
   * @example 6.4474
   */
  @IsLatitude()
  lat!: number;

  /**
   * @example 3.472
   */
  @IsLongitude()
  lng!: number;

  /**
   * @example Admiralty Way, Lekki Phase 1, Lagos
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

/** Ask to join a Hood offered by the last address check (contract §16). */
export class HoodRequestDto {
  /**
   * One of the `nearbyHoods` ids from `POST /users/me/verify-location`.
   * @example 66f1a2b3c4d5e6f7a8b9c0d1
   */
  @IsMongoId({ message: "Choose a neighbourhood." })
  hoodId!: string;
}

class NotificationChannelDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

class NotificationPrefsDto {
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) urgent_alerts?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) alerts?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) comments?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) messages?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) events?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) for_sale?: NotificationChannelDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationChannelDto) groups?: NotificationChannelDto;
}

class PrivacyDto {
  @IsOptional()
  @IsIn(["neighbourhood", "nearby"])
  profileVisibility?: "neighbourhood" | "nearby";

  @IsOptional()
  @IsIn(["neighbourhood", "contacts", "nobody"])
  messaging?: "neighbourhood" | "contacts" | "nobody";

  @IsOptional()
  @IsBoolean()
  showNeighbourSince?: boolean;
}

export class PreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;

  @IsOptional()
  @IsIn(["daily", "weekly", "off"])
  digest?: "daily" | "weekly" | "off";

  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacyDto)
  privacy?: PrivacyDto;
}

export class BlockDto {
  @IsString()
  @Length(1, 128)
  uid!: string;
}

export const DEACTIVATE_REASONS = ["moved", "not_useful", "privacy", "too_many_notifications", "negative", "few_neighbours", "duplicate", "other"] as const;

export class DeactivateDto {
  @IsIn(DEACTIVATE_REASONS)
  reason!: (typeof DEACTIVATE_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class UserSearchQuery {
  /** Name to search for (empty = first 20 neighbours). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}
