import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuditModule } from "../audit/audit.module";
import { HoodsModule } from "../hoods/hoods.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AdminInvitesController, InvitesController, PublicInvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";

/** Invite codes and referral paths (plan WP-E). */
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), HoodsModule, AuditModule],
  controllers: [InvitesController, PublicInvitesController, AdminInvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
