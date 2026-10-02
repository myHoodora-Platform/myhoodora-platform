import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PublicFormsController, SupportController } from "./inbound.controllers";
import { AiPilotRequest, AiPilotRequestSchema, InboundMessage, InboundMessageSchema, TalentProfile, TalentProfileSchema } from "./inbound.schemas";
import { InboundService } from "./inbound.service";

export { InboundService } from "./inbound.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InboundMessage.name, schema: InboundMessageSchema },
      { name: AiPilotRequest.name, schema: AiPilotRequestSchema },
      { name: TalentProfile.name, schema: TalentProfileSchema },
    ]),
  ],
  controllers: [SupportController, PublicFormsController],
  providers: [InboundService],
  exports: [InboundService],
})
export class InboundModule {}
