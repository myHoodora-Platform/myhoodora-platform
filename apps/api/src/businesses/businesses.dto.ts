import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";
import { PageQuery } from "../shared/http/pagination";
import { BUSINESS_CATEGORIES } from "./business.schema";

export class BusinessApplicationDto {
  @IsString() @Length(2, 80) businessName!: string;
  @IsIn(BUSINESS_CATEGORIES) category!: (typeof BUSINESS_CATEGORIES)[number];
  @IsString() @Length(20, 300) description!: string;
  /** Neighbourhood names from coverage. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) areasServed!: string[];
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsString() @Length(2, 80) contactName!: string;
  /** Nigerian mobile in E.164, e.g. +2348031234567 */
  @Matches(/^\+234[789][01]\d{8}$/, { message: "Enter a Nigerian mobile number, e.g. 0803 123 4567." }) phone!: string;
  @IsEmail() @MaxLength(254) email!: string;
  /** RC… or BN… (optional; sole traders welcome) */
  @IsOptional() @Matches(/^(RC|BN|IT)\s?\d{4,8}$/i, { message: "CAC numbers look like RC123456 or BN1234567." }) cacNumber?: string;
  @IsBoolean() wantsAdsUpdates!: boolean;
}

export class ClaimBusinessDto {
  @IsString() @Length(20, 100) token!: string;
}

export class AdminBusinessQuery extends PageQuery {
  @IsOptional() @IsIn(["applications", "verified", "reported", "rejected"]) tab?: "applications" | "verified" | "reported" | "rejected";
  @IsOptional() @IsIn(BUSINESS_CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(80) area?: string;
}

export class BusinessActionDto {
  @IsIn(["approve", "request_info", "reject", "suspend", "reinstate"]) action!: "approve" | "request_info" | "reject" | "suspend" | "reinstate";
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
  /** Sent to the applicant (request_info / reject). */
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  /** Staff record of the CAC register check, if done. */
  @IsOptional() @IsIn(["matched", "mismatch"]) cac?: "matched" | "mismatch";
}
