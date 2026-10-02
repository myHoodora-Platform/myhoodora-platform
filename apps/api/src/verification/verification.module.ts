import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { EmailVerification, EmailVerificationSchema } from "./email-verification.schema";
import { EmailVerificationService } from "./email-verification.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailVerification.name, schema: EmailVerificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class VerificationModule {}
