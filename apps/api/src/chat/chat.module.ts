import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ListingsModule } from "../listings/listings.module";
import { ChatController } from "./chat.controller";
import { Conversation, ConversationSchema, Message, MessageSchema } from "./chat.schemas";
import { ChatService } from "./chat.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    ListingsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
