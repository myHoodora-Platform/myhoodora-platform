import { Type } from "class-transformer";
import { IsIn, IsMongoId, IsOptional, IsString, Length, MaxLength, ValidateNested } from "class-validator";

export class ChatContextDto {
  @IsIn(["listing"]) type!: "listing";
  /** Listing id; title/photo/price are filled in by the server. */
  @IsMongoId() id!: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(500) photo?: string;
  @IsOptional() priceNaira?: number | null;
}

export class StartConversationDto {
  @IsString() @Length(1, 128) recipientUid!: string;
  @IsOptional() @ValidateNested() @Type(() => ChatContextDto) context?: ChatContextDto;
}

export class SendMessageDto {
  @IsString() @Length(1, 2000) body!: string;
}
