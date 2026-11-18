import { Body, Controller, Get, Module, Param, Post, Put, Query } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, Length } from "class-validator";
import { CommentsModule } from "../comments/comments.module";
import { HoodsModule } from "../hoods/hoods.module";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { User, UserSchema } from "../users/schemas/user.schema";
import { HoodAssignment, HoodAssignmentSchema, ModConsoleService } from "./mod-console.service";

class NeedsReplyQuery {
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() mine?: boolean;
  @IsOptional() @IsMongoId() hoodId?: string;
}

class ConsoleReplyDto {
  @IsMongoId() postId!: string;
  @IsString() @Length(1, 2000) content!: string;
  @IsIn(["self", "team"]) as!: "self" | "team";
}

class AssignmentDto {
  @IsArray() @ArrayMaxSize(500) @IsMongoId({ each: true }) hoodIds!: string[];
}

/** The moderator console (contract §45). Moderators and up reply; admins assign Hoods. */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access", "moderation.act")
@Controller("admin/console")
export class ModConsoleController {
  constructor(private readonly console: ModConsoleService) {}

  @Get("needs-reply")
  @ApiOperation({ summary: "Posts nobody has answered (last 3 days): newcomers' first posts first (?mine=true for my Hoods, ?hoodId)" })
  needsReply(@CurrentViewer() viewer: Viewer, @Query() q: NeedsReplyQuery) {
    return this.console.needsReply(viewer, q);
  }

  @Post("reply")
  @ApiOperation({ summary: "Reply as yourself (Staff label) or as the Hood Team" })
  @ApiNotFound("Post")
  reply(@CurrentViewer() viewer: Viewer, @Body() body: ConsoleReplyDto) {
    return this.console.reply(viewer, body);
  }

  @Get("stats")
  @ApiOperation({ summary: "Last 7 days: posts, how many got a reply, the median minutes to the first, first replies per staff member" })
  stats() {
    return this.console.stats();
  }

  @Get("assignments")
  @ApiOperation({ summary: "Who looks after which Hoods" })
  assignments() {
    return this.console.listAssignments();
  }

  @Put("assignments/:uid")
  @Can("admin.access", "team.manage")
  @ApiOperation({ summary: "Set the Hoods a staff member looks after" })
  @ApiNotFound("Staff member")
  async setAssignment(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string, @Body() body: AssignmentDto) {
    await this.console.setAssignment(viewer, uid, body.hoodIds);
    return this.console.listAssignments();
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HoodAssignment.name, schema: HoodAssignmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommentsModule,
    HoodsModule,
  ],
  controllers: [ModConsoleController],
  providers: [ModConsoleService],
})
export class ModConsoleModule {}
