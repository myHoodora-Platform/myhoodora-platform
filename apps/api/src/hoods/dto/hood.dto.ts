import { Type } from "class-transformer";
import { IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";
import { HOOD_STATUSES, type HoodStatus } from "../schemas/hood.schema";

export class PointDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateHoodDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 60)
  city!: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @ValidateNested()
  @Type(() => PointDto)
  center!: PointDto;

  @IsInt()
  @Min(300)
  @Max(20_000)
  radiusMeters!: number;
}

export class UpdateHoodDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(20_000)
  radiusMeters?: number;

  @IsOptional()
  @IsIn(HOOD_STATUSES)
  status?: HoodStatus;

  /** Recorded in the audit log. */
  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}
