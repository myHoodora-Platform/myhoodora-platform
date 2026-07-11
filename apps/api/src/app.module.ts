import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import configuration from './config/configuration';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { NeighborhoodsModule } from './neighborhoods/neighborhoods.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // ── MongoDB ──────────────────────────────────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodb.uri'),
      }),
    }),

    // ── Rate limiting (three tiers) ───────────────────────────────────────────
    // short  — 10 req / 1 s   (burst protection)
    // medium — 60 req / 1 min (per-minute cap)
    // long   — 500 req / 1 h  (hourly ceiling)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 60 },
      { name: 'long', ttl: 3_600_000, limit: 500 },
    ]),

    // ── Health checks ────────────────────────────────────────────────────────
    TerminusModule,

    // ── Feature modules ──────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    PostsModule,
    NeighborhoodsModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,

    // 1️⃣ Rate-limit guard — runs first, before auth
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // 2️⃣ Firebase Auth guard — applied to every route; opt-out with @Public()
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule { }

