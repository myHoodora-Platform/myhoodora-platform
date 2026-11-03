import { IsIn, IsLatitude, IsLongitude, IsMongoId, IsOptional, IsString, Length, MaxLength, ValidateIf } from "class-validator";
import { PageQuery } from "../shared/http/pagination";
import { HOOD_REQUEST_KINDS, HOOD_REQUEST_STATUSES, type HoodRequestKind, type HoodRequestStatus } from "./hood-request.schema";

export class CreateHoodRequestDto {
  @IsIn(HOOD_REQUEST_KINDS)
  kind!: HoodRequestKind;

  /** Secondary: the Hood to add (from GET /neighborhoods). */
  @ValidateIf((o: CreateHoodRequestDto) => o.kind === "secondary")
  @IsMongoId()
  hoodId?: string;

  /** Why: work, family, a shop you run there… (10–500 characters). */
  @IsString()
  @Length(10, 500, { message: "Tell us why in at least 10 characters." })
  reason!: string;

  /** Move: the new home address and its point (from the address lookup or the phone's location). */
  @ValidateIf((o: CreateHoodRequestDto) => o.kind === "move")
  @IsString()
  @Length(5, 300)
  address?: string;

  @ValidateIf((o: CreateHoodRequestDto) => o.kind === "move")
  @IsLatitude()
  lat?: number;

  @ValidateIf((o: CreateHoodRequestDto) => o.kind === "move")
  @IsLongitude()
  lng?: number;
}

export class HoodRequestQuery extends PageQuery {
  @IsOptional()
  @IsIn(HOOD_REQUEST_STATUSES)
  status?: HoodRequestStatus;

  @IsOptional()
  @IsIn(HOOD_REQUEST_KINDS)
  kind?: HoodRequestKind;
}

export class ApproveHoodRequestDto {
  /** Move: the Hood to move them to, when it isn't the one their address falls in. */
  @IsOptional()
  @IsMongoId()
  hoodId?: string;

  /** Staff only: kept in the audit log, never shown to the neighbour. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DeclineHoodRequestDto {
  /** Shown to the neighbour. */
  @IsString()
  @Length(3, 500)
  reason!: string;

  /** Staff only (audit log). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class HoodRequestChatDto {
  @IsString()
  @Length(2, 4000)
  body!: string;
}

export class RemoveSecondaryHoodDto {
  /** Shown to the neighbour. */
  @IsString()
  @Length(3, 500)
  reason!: string;

  /** Staff only (audit log). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
