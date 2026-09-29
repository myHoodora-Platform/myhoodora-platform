import { Body, Controller, HttpCode, Injectable, Module, Post } from "@nestjs/common";
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { Model } from "mongoose";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";

/** Messages into the team's inbox (feedback now; contact form in pass 2). */
@Schema({ timestamps: true, collection: "inbound_messages" })
export class InboundMessage {
  @Prop({ required: true, enum: ["feedback", "contact"] }) source!: "feedback" | "contact";
  @Prop() uid?: string;
  @Prop({ required: true }) kind!: string;
  @Prop({ required: true, maxlength: 2000 }) message!: string;
  @Prop({ maxlength: 200 }) path?: string;
  @Prop({ required: true, enum: ["open", "waiting", "resolved"], default: "open", index: true }) status!: string;
}
export const InboundMessageSchema = SchemaFactory.createForClass(InboundMessage);

class FeedbackDto {
  @IsIn(["idea", "problem", "praise", "other"]) kind!: "idea" | "problem" | "praise" | "other";
  @IsString() @Length(5, 2000) message!: string;
  @IsOptional() @IsString() @MaxLength(200) path?: string;
}

@Injectable()
export class InboundService {
  constructor(@InjectModel(InboundMessage.name) private readonly inbound: Model<InboundMessage>) {}

  async feedback(uid: string, dto: FeedbackDto) {
    await this.inbound.create({ source: "feedback", uid, kind: dto.kind, message: dto.message, path: dto.path });
  }

  openCount() {
    return this.inbound.countDocuments({ status: "open" }).exec();
  }
}

@ApiTags("feedback")
@ApiBearerAuth("firebase-jwt")
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly inbound: InboundService) {}

  /** Contract §10: POST /feedback → 204. */
  @Post()
  @HttpCode(204)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  async create(@CurrentViewer() viewer: Viewer, @Body() body: FeedbackDto) {
    await this.inbound.feedback(viewer.uid, body);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: InboundMessage.name, schema: InboundMessageSchema }])],
  controllers: [FeedbackController],
  providers: [InboundService],
  exports: [InboundService],
})
export class InboundModule {}
