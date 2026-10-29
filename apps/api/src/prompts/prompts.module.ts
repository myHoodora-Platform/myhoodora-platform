import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { EngagementCounter, EngagementCounterSchema, Prompt, PromptExposure, PromptExposureSchema, PromptResponse, PromptResponseSchema, PromptSchema, PromptSettings, PromptSettingsSchema } from "./prompt.schema";
import { AdminPromptsController, PromptsController } from "./prompts.controller";
import { PromptsService } from "./prompts.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prompt.name, schema: PromptSchema },
      { name: PromptResponse.name, schema: PromptResponseSchema },
      { name: PromptExposure.name, schema: PromptExposureSchema },
      { name: EngagementCounter.name, schema: EngagementCounterSchema },
      { name: PromptSettings.name, schema: PromptSettingsSchema },
    ]),
    HoodsModule,
  ],
  controllers: [PromptsController, AdminPromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
