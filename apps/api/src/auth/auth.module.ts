import { Module } from "@nestjs/common";
import { VerificationModule } from "../verification/verification.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionRevocationService } from "./session-revocation.service";

@Module({
  imports: [VerificationModule],
  controllers: [AuthController],
  providers: [AuthService, SessionRevocationService],
  exports: [AuthService, SessionRevocationService],
})
export class AuthModule {}
