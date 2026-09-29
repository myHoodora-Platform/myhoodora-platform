import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { TerminusModule } from "@nestjs/terminus";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import configuration, { validateEnv } from "./config/configuration";
import { AccountGuard } from "./shared/auth/account.guard";
import { FirebaseAuthGuard } from "./shared/auth/firebase-auth.guard";
import { CapabilityGuard } from "./shared/authz/can.decorator";
import { AllExceptionsFilter } from "./shared/http/all-exceptions.filter";

import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CommentsModule } from "./comments/comments.module";
import { CommunicationsModule } from "./communications/communications.module";
import { HoodsModule } from "./hoods/hoods.module";
import { InboundModule } from "./inbound/inbound.module";
import { ModerationRegistryModule } from "./moderation/moderation-registry";
import { ModerationModule } from "./moderation/moderation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlatformModule } from "./platform/platform.module";
import { PostsModule } from "./posts/posts.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration], envFilePath: ".env", validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>("mongodb.uri"), autoIndex: config.get<string>("nodeEnv") !== "production" }),
    }),
    // short 10/s burst · medium 60/min · long 500/h (per IP); stricter per route where needed.
    ThrottlerModule.forRoot([
      { name: "short", ttl: 1_000, limit: 10 },
      { name: "medium", ttl: 60_000, limit: 60 },
      { name: "long", ttl: 3_600_000, limit: 500 },
    ]),
    TerminusModule,

    // Cross-cutting (global) modules
    AuditModule,
    CommunicationsModule,
    NotificationsModule,
    PlatformModule,
    ModerationRegistryModule,

    // Domains
    AuthModule,
    UsersModule,
    HoodsModule,
    PostsModule,
    CommentsModule,
    ModerationModule,
    InboundModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: rate limit → authenticate → load account → check capabilities.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: AccountGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
