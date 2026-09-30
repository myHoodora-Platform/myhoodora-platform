import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from "class-validator";
import { INBOX_PRIORITIES, INBOX_SOURCES, INBOX_STATUSES } from "./inbound.schemas";
import { PageQuery } from "../shared/http/pagination";

export const CONTACT_TOPICS = ["general", "account", "safety", "business", "press", "partnerships", "ai"] as const;
export const TALENT_TEAMS = ["engineering", "design", "community", "growth", "operations"] as const;
export const INSTITUTION_TYPES = ["primary", "secondary", "university", "online", "corporate", "other"] as const;
export const SUPPORT_TOPICS = ["account", "verification", "safety", "bug", "other"] as const;

export class FeedbackDto {
  @IsIn(["idea", "problem", "praise", "other"]) kind!: "idea" | "problem" | "praise" | "other";
  @IsString() @Length(5, 2000) message!: string;
  @IsOptional() @IsString() @MaxLength(200) path?: string;
}

/** In-app help request (signed in). */
export class SupportRequestDto {
  /**
   * @example My address keeps failing verification even though the pin is right.
   */
  @IsIn(SUPPORT_TOPICS) topic!: (typeof SUPPORT_TOPICS)[number];
  @IsString() @Length(20, 2000) message!: string;
}

export class ContactDto {
  @IsIn(CONTACT_TOPICS) topic!: (typeof CONTACT_TOPICS)[number];
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(20, 2000) message!: string;
  @IsOptional() @IsString() @MaxLength(120) organisation?: string;
}

export class TalentDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(TALENT_TEAMS) team!: (typeof TALENT_TEAMS)[number];
  @IsString() @Length(2, 60) city!: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(300) link?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AiPilotDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(2, 120) institution!: string;
  @IsIn(INSTITUTION_TYPES) institutionType!: (typeof INSTITUTION_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(80) role?: string;
  @IsOptional() @IsString() @MaxLength(300) subjects?: string;
}

export class InboxQuery extends PageQuery {
  @IsOptional() @IsIn(INBOX_STATUSES) status?: (typeof INBOX_STATUSES)[number];
  @IsOptional() @IsIn(INBOX_SOURCES) source?: (typeof INBOX_SOURCES)[number];
  @IsOptional() @IsString() @MaxLength(40) topic?: string;
}

/** A neighbour's reply in their support conversation. */
export class SupportMessageDto {
  /**
   * @example Thanks, that fixed it!
   */
  @IsString() @Length(1, 2000) body!: string;
}

/** Staff starting a conversation with one neighbour. */
export class StartInboxConversationDto {
  /**
   * The neighbour's Firebase uid.
   * @example u3Q9Lp2aFzT8example
   */
  /**
   * @example About your verification
   */
  /**
   * @example Hi, we've checked your address and moved you to the right Hood.
   */
  @IsString() @Length(1, 128) uid!: string;
  @IsString() @Length(3, 120) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
}

export class InboxReplyDto {
  @IsString() @Length(2, 4000) body!: string;
  /** Resolve the thread with this reply. */
  @IsOptional() @IsBoolean() resolve?: boolean;
}

export class InboxUpdateDto {
  @IsOptional() @IsIn(INBOX_STATUSES) status?: (typeof INBOX_STATUSES)[number];
  @IsOptional() @IsIn(INBOX_PRIORITIES) priority?: (typeof INBOX_PRIORITIES)[number];
  /** Assign to the caller. */
  @IsOptional() @IsBoolean() assignToMe?: boolean;
  /** Assign to a staff member (contract §13.8). */
  @IsOptional() @IsString() @MaxLength(128) assigneeUid?: string;
}

export class SignupQuery {
  @IsIn(["ai_pilot", "talent", "business_ads"]) type!: "ai_pilot" | "talent" | "business_ads";
}
