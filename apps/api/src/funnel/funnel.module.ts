import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Post, Query } from "@nestjs/common";
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsDateString } from "class-validator";
import { Model } from "mongoose";
import { lagosDay } from "../engagement/domain/streak";
import { Public } from "../shared/auth/public.decorator";
import { Can } from "../shared/authz/can.decorator";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { FUNNEL_EVENTS, type FunnelEvent } from "./funnel";

@Schema({ collection: "funnel_counts" })
export class FunnelCount {
  @Prop({ required: true }) day!: string;
  @Prop({ required: true, enum: FUNNEL_EVENTS }) event!: FunnelEvent;
  @Prop({ default: 0 }) n!: number;
}
export const FunnelCountSchema = SchemaFactory.createForClass(FunnelCount);
FunnelCountSchema.index({ day: 1, event: 1 }, { unique: true });

class FunnelEventDto {
  @IsIn(FUNNEL_EVENTS) event!: FunnelEvent;
}

class FunnelQuery {
  @IsOptional() @IsDateString() from?: string;
}

@Injectable()
export class FunnelService {
  constructor(@InjectModel(FunnelCount.name) private readonly counts: Model<FunnelCount>) {}

  async count(event: FunnelEvent, now = new Date()): Promise<void> {
    await this.counts.updateOne({ day: lagosDay(now), event }, { $inc: { n: 1 } }, { upsert: true }).exec();
  }

  /** Per day and event since `from` (default: 30 days). */
  async series(from?: string): Promise<{ days: string[]; totals: Record<FunnelEvent, number>; daily: Record<string, Partial<Record<FunnelEvent, number>>> }> {
    const since = lagosDay(from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000));
    const rows = await this.counts.find({ day: { $gte: since } }).lean<FunnelCount[]>().exec();
    const totals = Object.fromEntries(FUNNEL_EVENTS.map((e) => [e, 0])) as Record<FunnelEvent, number>;
    const daily: Record<string, Partial<Record<FunnelEvent, number>>> = {};
    for (const r of rows) {
      totals[r.event] += r.n;
      (daily[r.day] ??= {})[r.event] = r.n;
    }
    return { days: Object.keys(daily).sort(), totals, daily };
  }
}

/** Anonymous funnel counts (contract §43). Public: the steps happen before anyone signs in. */
@ApiTags("public")
@ApiStandardErrors()
@Controller("public/funnel")
export class PublicFunnelController {
  constructor(private readonly funnel: FunnelService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  // Generous: many phones share one address behind mobile carriers; a lost count doesn't matter.
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Count one funnel step (no personal data)" })
  async count(@Body() body: FunnelEventDto) {
    await this.funnel.count(body.event);
  }
}

@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin/funnel")
export class AdminFunnelController {
  constructor(private readonly funnel: FunnelService) {}

  @Get()
  @ApiOperation({ summary: "Funnel counts per day (?from, default the last 30 days)" })
  series(@Query() q: FunnelQuery) {
    return this.funnel.series(q.from);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: FunnelCount.name, schema: FunnelCountSchema }])],
  controllers: [PublicFunnelController, AdminFunnelController],
  providers: [FunnelService],
  exports: [FunnelService],
})
export class FunnelModule {}
