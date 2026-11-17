import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from "class-validator";
import { INVITE_VIAS, type InviteVia } from "./domain/invite-code";

const CODE_INPUT = /^[A-Za-z0-9\s-]{4,14}$/;

/** POST /invites/claim: a code (any path), or a neighbour picked from their Hood ("Who invited you?"). */
export class ClaimInviteDto {
  @IsOptional() @Matches(CODE_INPUT, { message: "Invite codes are letters and numbers, like ADA7K." }) code?: string;
  @IsOptional() @IsString() @Length(1, 128) uid?: string;
  @IsIn(INVITE_VIAS) via!: InviteVia;
}

export class InviteLeaderboardQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsMongoId() hoodId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @IsIn(["json", "csv"]) format?: "json" | "csv";
}

/** PUT /admin/invites/:uid: credit someone else (`code`), or nobody (null). */
export class SetInviterDto {
  @ValidateIf((_, v) => v !== null) @Matches(CODE_INPUT) code!: string | null;
  @IsString() @Length(3, 300) reason!: string;
}
