import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateNested } from "class-validator";

export class ChatContextDto {
  @IsIn(["listing"]) type!: "listing";
  /** Listing id; title/photo/price are filled in by the server. */
  @IsMongoId() id!: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(500) photo?: string;
  @IsOptional() priceNaira?: number | null;
}

export class StartConversationDto {
  /**
   * The other neighbour's Firebase uid.
   * @example u3Q9Lp2aFzT8example
   */
  @IsString() @Length(1, 128) recipientUid!: string;
  @IsOptional() @ValidateNested() @Type(() => ChatContextDto) context?: ChatContextDto;
}

export class SendMessageDto {
  /** The text; may be left out (or empty) when `photos` are sent. */
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
  /** Up to 4 photos uploaded with purpose "message" (2026-10-28). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  photos?: string[];
  /** The message this one replies to, in the same conversation. */
  @IsOptional() @IsMongoId() replyTo?: string;
}

/** One emoji (any, with skin tone or joined), or null to take your reaction back. */
export class ReactDto {
  /** @example "👍🏽" */
  @IsOptional() @IsString() @MaxLength(16) emoji?: string | null;
}

export class EditMessageDto {
  @IsString() @MaxLength(2000) body!: string;
}

export class ArchiveConversationDto {
  @IsBoolean() archived!: boolean;
}

export const MUTE_FOR = ["8h", "1w", "always", "off"] as const;
export class MuteConversationDto {
  /** How long to stay quiet: 8 hours, a week, until turned back on, or not at all. */
  @IsIn(MUTE_FOR) for!: (typeof MUTE_FOR)[number];
}

export class ConversationListQuery {
  /** `true`: only the conversations you archived. Otherwise they're left out. */
  @IsOptional() @IsIn(["true", "false"]) archived?: "true" | "false";
  /** `true`: only message requests waiting for you (2026-10-29). Otherwise they're left out. */
  @IsOptional() @IsIn(["true", "false"]) requests?: "true" | "false";
}

/** POST /conversations/groups: a group chat with neighbours you choose (up to 49 others). */
export class CreateGroupChatDto {
  /** @example "Road 4 neighbours" */
  @IsString() @Length(1, 60) title!: string;
  @IsArray() @ArrayMaxSize(49) @IsString({ each: true }) @Length(1, 128, { each: true }) memberUids!: string[];
}

export class RenameGroupChatDto {
  @IsString() @Length(1, 60) title!: string;
}

export class AddGroupMembersDto {
  @IsArray() @ArrayMaxSize(49) @IsString({ each: true }) @Length(1, 128, { each: true }) uids!: string[];
}

export class GroupAdminDto {
  @IsBoolean() admin!: boolean;
}

export class PinChatDto {
  @IsBoolean() pinned!: boolean;
}

export const PIN_FOR = ["24h", "7d", "30d"] as const;
export class PinMessageDto {
  /** How long it stays pinned, as on WhatsApp. */
  @IsIn(PIN_FOR) for!: (typeof PIN_FOR)[number];
}

/** Up to 5 chats in all, by conversation or by neighbour (a chat with them is opened if need be). */
export class ForwardMessageDto {
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsMongoId({ each: true }) conversationIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @Length(1, 128, { each: true }) recipientUids?: string[];
}
