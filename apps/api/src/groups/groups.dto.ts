import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, IsUrl, Length, MaxLength } from "class-validator";
import { GROUP_BOUNDARIES, GROUP_CATEGORIES, GROUP_PRIVACY, type GroupBoundary, type GroupPrivacy } from "./group.schemas";

export class CreateGroupDto {
  @IsString() @Length(3, 60) name!: string;
  @IsString() @Length(10, 500) description!: string;
  @IsIn(GROUP_CATEGORIES) category!: (typeof GROUP_CATEGORIES)[number];
  @IsIn(GROUP_PRIVACY) privacy!: GroupPrivacy;
  @IsIn(GROUP_BOUNDARIES) boundary!: GroupBoundary;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) coverPhoto?: string;
  /** Must be your own Hood if sent. */
  @IsOptional() @IsMongoId() neighborhoodId?: string;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @Length(3, 60) name?: string;
  @IsOptional() @IsString() @Length(10, 500) description?: string;
  @IsOptional() @IsIn(GROUP_CATEGORIES) category?: (typeof GROUP_CATEGORIES)[number];
  @IsOptional() @IsIn(GROUP_PRIVACY) privacy?: GroupPrivacy;
  @IsOptional() @IsIn(GROUP_BOUNDARIES) boundary?: GroupBoundary;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) coverPhoto?: string;
}

export class GroupListQuery {
  /** Your Hood (optional; always your own). */
  @IsOptional() @IsMongoId() neighborhoodId?: string;
}

export class GroupViewQuery {
  /** Invite token from a shared link; lets you see a group outside your area. */
  @IsOptional() @IsString() @MaxLength(64) invite?: string;
}

export class JoinGroupDto {
  @IsOptional() @IsString() @MaxLength(64) inviteToken?: string;
}

export class InviteLinkDto {
  /** Admins: revoke old links and issue a new one. */
  @IsOptional() @IsBoolean() reset?: boolean;
}

export class InviteNeighboursDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) uids!: string[];
}

export class RemoveMemberDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class MemberRoleDto {
  @IsIn(["admin", "member"]) role!: "admin" | "member";
}

export class GroupPostDto {
  @IsString() @Length(1, 4000) content!: string;
}

export class AdminGroupActionDto {
  /** `remove`/`archive` hide the group; `restore` brings it back. */
  @IsIn(["remove", "archive", "restore"]) action!: "remove" | "archive" | "restore";
  @IsString() @Length(2, 200) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
