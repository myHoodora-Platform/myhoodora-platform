import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AdminEngagementController, EngagementController } from "./engagement.controller";
import { EngagementSettings, EngagementSettingsSchema } from "./engagement-settings.schema";
import { EngagementService } from "./engagement.service";

/** Streaks, the launch challenge and badges (plan WP-C). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: EngagementSettings.name, schema: EngagementSettingsSchema },
    ]),
    HoodsModule,
  ],
  controllers: [EngagementController, AdminEngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
