import { Body, Controller, Global, HttpCode, Injectable, Module, Post } from "@nestjs/common";
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional } from "class-validator";
import { Model } from "mongoose";
import { ApiStandardErrors } from "../shared/http/api-docs";

/** Daily counters only: no user ids, no content (privacy by design). */
@Schema({ collection: "telemetry_daily" })
export class TelemetryDaily {
  @Prop({ required: true }) day!: string;
  @Prop({ required: true }) metric!: string;
  @Prop({ default: 0 }) count!: number;
}
export const TelemetryDailySchema = SchemaFactory.createForClass(TelemetryDaily);
TelemetryDailySchema.index({ day: 1, metric: 1 }, { unique: true });

class KindnessDto {
  /** What the neighbour did after the reminder. Omitted = just shown. */
  @IsOptional() @IsIn(["shown", "edited", "posted_anyway", "discarded"]) outcome?: "shown" | "edited" | "posted_anyway" | "discarded";
}

@Injectable()
export class TelemetryService {
  constructor(@InjectModel(TelemetryDaily.name) private readonly daily: Model<TelemetryDaily>) {}

  async bump(metric: string): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    await this.daily.updateOne({ day, metric }, { $inc: { count: 1 } }, { upsert: true }).exec();
  }

  async total(metric: string, sinceDays: number): Promise<number> {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.daily.aggregate<{ n: number }>([{ $match: { metric, day: { $gte: since } } }, { $group: { _id: null, n: { $sum: "$count" } } }]);
    return rows[0]?.n ?? 0;
  }
}

@ApiTags("telemetry")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("telemetry")
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post("kindness")
  @HttpCode(204)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Count a kindness reminder (anonymous daily counter)" })
  @ApiNoContentResponse()
  async kindness(@Body() body: KindnessDto) {
    await this.telemetry.bump(`kindness.${body?.outcome ?? "shown"}`);
  }
}

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: TelemetryDaily.name, schema: TelemetryDailySchema }])],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
