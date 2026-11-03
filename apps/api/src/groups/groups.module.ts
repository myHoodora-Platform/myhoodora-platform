import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { Group, GroupMember, GroupMemberSchema, GroupPost, GroupPostSchema, GroupRequest, GroupRequestSchema, GroupSchema } from "./group.schemas";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupRequest.name, schema: GroupRequestSchema },
      { name: GroupPost.name, schema: GroupPostSchema },
    ]),
    HoodsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
