import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateNested } from "class-validator";

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

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  photoURL?: string;
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
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
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
