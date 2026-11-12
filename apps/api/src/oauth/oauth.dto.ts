import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * POST /oauth/authorize: the authorisation request (contract §4.1) as the web page received it, plus
 * the person's answer. Every field is optional here so that a request with a known client and
 * redirect URI but a bad parameter is answered with a redirect carrying `invalid_request`, as OAuth
 * requires, rather than a 400 the client never sees.
 */
export class AuthorizeDto {
  @ApiPropertyOptional({ example: "code" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  response_type?: string;
  @ApiPropertyOptional({ example: "myhoodora-ai" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  client_id?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirect_uri?: string;
  @ApiPropertyOptional({ example: "openid email profile" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scope?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  state?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nonce?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code_challenge?: string;
  @ApiPropertyOptional({ example: "S256" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code_challenge_method?: string;
  /** "cancel": they chose not to continue; the client hears `access_denied`. */
  @ApiPropertyOptional({ enum: ["cancel"] })
  @IsOptional()
  @IsIn(["cancel"])
  decision?: "cancel";
}
