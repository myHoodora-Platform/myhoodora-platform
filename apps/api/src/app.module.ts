import { AdsModule } from "./ads/ads.module";
import { PromptsModule } from "./prompts/prompts.module";
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
import { AccountThrottlerGuard, FloodGuard, THROTTLERS } from "./shared/throttle/throttle.guards";

import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CommentsModule } from "./comments/comments.module";
import { CommunicationsModule } from "./communications/communications.module";
import { HoodsModule } from "./hoods/hoods.module";
import { HoodRequestsModule } from "./hood-requests/hood-requests.module";
import { InboundModule } from "./inbound/inbound.module";
import { JobsModule } from "./jobs/jobs.module";
import { ModerationRegistryModule } from "./moderation/moderation-registry";
import { AccountLifecycleModule } from "./users/account-lifecycle";
import { ModerationModule } from "./moderation/moderation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OAuthModule } from "./oauth/oauth.module";
import { PlatformModule } from "./platform/platform.module";
import { PostsModule } from "./posts/posts.module";
import { PushModule } from "./push/push.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { HoodContentModule } from "./hood-content/hood-content.module";
import { PublicPostsModule } from "./public-posts/public-posts.module";
import { InvitesModule } from "./invites/invites.module";
import { SeasonsModule } from "./seasons/seasons.module";
import { EngagementModule } from "./engagement/engagement.module";
import { FunnelModule } from "./funnel/funnel.module";
import { ModConsoleModule } from "./mod-console/mod-console.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
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
    // Two stages, per route: a flood ceiling per address, then per person (shared/throttle/throttle.guards.ts).
    ThrottlerModule.forRoot([...THROTTLERS]),
    TerminusModule,

    // Cross-cutting (global) modules
    AuditModule,
    JobsModule,
    CommunicationsModule,
    RealtimeModule,
    StorageModule,
    PushModule,
    NotificationsModule,
    OAuthModule,
    PlatformModule,
    ModerationRegistryModule,
    AccountLifecycleModule,

    // Domains
    AuthModule,
    UsersModule,
    HoodsModule,
    PostsModule,
    AdsModule,
    PromptsModule,
    HoodContentModule,
    PublicPostsModule,
    InvitesModule,
    SeasonsModule,
    EngagementModule,
    FunnelModule,
    ModConsoleModule,
    DashboardsModule,
    SearchModule,
    CommentsModule,
    ModerationModule,
    InboundModule,
    HoodRequestsModule,
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
