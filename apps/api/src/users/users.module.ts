import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { HoodsModule } from "../hoods/hoods.module";
import { VerificationModule } from "../verification/verification.module";
import { AccountDeletionService } from "./account-deletion.service";
import { User, UserSchema } from "./schemas/user.schema";
import { StaffUsersService } from "./staff-users.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/** Global so AccountGuard (an app-wide guard) can read the User model. */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), HoodsModule, VerificationModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, StaffUsersService, AccountDeletionService],
  exports: [UsersService, StaffUsersService, AccountDeletionService, MongooseModule],
})
export class UsersModule {}
