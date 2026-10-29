import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Group, GroupMember, GroupMemberSchema, GroupSchema } from "../groups/group.schemas";
import { ListingsModule } from "../listings/listings.module";
import { ChatController } from "./chat.controller";
import { Conversation, ConversationSchema, Message, MessageSchema } from "./chat.schemas";
import { ChatService } from "./chat.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      // Read only: who is in a community Group, for its chat.
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
    ]),
    ListingsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
