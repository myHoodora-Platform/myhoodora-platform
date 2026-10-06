import { BusinessesModule } from "./businesses/businesses.module";
import { ChatModule } from "./chat/chat.module";
import { GroupsModule } from "./groups/groups.module";
import { ListingsModule } from "./listings/listings.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { TerminusModule } from "@nestjs/terminus";
import { ThrottlerModule } from "@nestjs/throttler";

import configuration, { validateEnv } from "./config/configuration";
import { AccountGuard } from "./shared/auth/account.guard";
import { FirebaseAuthGuard } from "./shared/auth/firebase-auth.guard";
import { CapabilityGuard } from "./shared/authz/can.decorator";
import { AllExceptionsFilter } from "./shared/http/all-exceptions.filter";
import { AccountThrottlerGuard, FLOOD, FloodGuard } from "./shared/throttle/throttle.guards";

import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CommentsModule } from "./comments/comments.module";
import { CommunicationsModule } from "./communications/communications.module";
import { HoodsModule } from "./hoods/hoods.module";
import { InboundModule } from "./inbound/inbound.module";
import { JobsModule } from "./jobs/jobs.module";
import { ModerationRegistryModule } from "./moderation/moderation-registry";
import { AccountLifecycleModule } from "./users/account-lifecycle";
import { ModerationModule } from "./moderation/moderation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlatformModule } from "./platform/platform.module";
import { PostsModule } from "./posts/posts.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SearchModule } from "./search/search.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration], envFilePath: ".env", validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      // autoIndex creates *missing* indexes at boot (never drops). Unique indexes carry
      // real rules here (one vote per Lead, one thread per pair…), so it's on by default;
      // set MONGO_AUTO_INDEX=false once indexes are managed in Atlas.
      useFactory: (config: ConfigService) => ({ uri: config.get<string>("mongodb.uri"), autoIndex: process.env.MONGO_AUTO_INDEX !== "false" }),
    }),
    // Two stages (shared/throttle/throttle.guards.ts).
    // Before sign-in is checked, per address: only a flood ceiling, because one address can be a whole
    // estate or mobile carrier. 100 requests a second, counted over 10 s.
    // After it, per person (per address on public routes): short 10/s burst · medium 60/min · long 500/h,
    // stricter per route where needed.
    // Counters are in this instance's memory: with several instances each enforces its own.
    ThrottlerModule.forRoot([
      { name: FLOOD, ttl: 10_000, limit: 1_000 },
      { name: "short", ttl: 1_000, limit: 10 },
      { name: "medium", ttl: 60_000, limit: 60 },
      { name: "long", ttl: 3_600_000, limit: 500 },
    ]),
    TerminusModule,

    // Cross-cutting (global) modules
    AuditModule,
    JobsModule,
    CommunicationsModule,
    RealtimeModule,
    StorageModule,
    NotificationsModule,
    PlatformModule,
    ModerationRegistryModule,
    AccountLifecycleModule,

    // Domains
    AuthModule,
    UsersModule,
    HoodsModule,
    PostsModule,
    SearchModule,
    CommentsModule,
    ModerationModule,
    InboundModule,
    ListingsModule,
    GroupsModule,
    ChatModule,
    BusinessesModule,
    TelemetryModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: flood limit → authenticate → rate limit per person → load account → check capabilities.
    { provide: APP_GUARD, useClass: FloodGuard },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: AccountThrottlerGuard },
    { provide: APP_GUARD, useClass: AccountGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
