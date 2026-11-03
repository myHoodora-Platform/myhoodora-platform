import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { InboundModule } from "../inbound/inbound.module";
import { HoodRequest, HoodRequestSchema } from "./hood-request.schema";
import { AdminHoodRequestsController, HoodRequestsController } from "./hood-requests.controller";
import { HoodRequestsService } from "./hood-requests.service";

/** Secondary neighbourhoods and move requests (contract §31). Users (global) supplies the User model. */
@Module({
  imports: [MongooseModule.forFeature([{ name: HoodRequest.name, schema: HoodRequestSchema }]), HoodsModule, InboundModule],
  controllers: [HoodRequestsController, AdminHoodRequestsController],
  providers: [HoodRequestsService],
})
export class HoodRequestsModule {}
