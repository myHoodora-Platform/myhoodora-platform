import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { MongoChangeStreamBus } from "./mongo.bus";
import { REALTIME_BUS, type RealtimeBus } from "./realtime.bus";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";
import { RedisRealtimeBus } from "./redis.bus";
import { selectRealtimeBus, type BusMode } from "./select-bus";

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [
    RealtimeService,
    {
      provide: REALTIME_BUS,
      inject: [ConfigService, getConnectionToken()],
      // Same shape as EMAIL_PROVIDER: the transport is chosen here; nothing
      // that publishes knows or cares which one it is.
      useFactory: (config: ConfigService, connection: Connection): Promise<RealtimeBus> => {
        const env = config.get<string>("realtime.env")!;
        const redisChannel = `myhoodora:realtime:${env}`;
        return selectRealtimeBus({
          mode: config.get<BusMode>("realtime.bus") ?? "auto",
          redisUrl: config.get<string>("realtime.redisUrl"),
          connectRedis: (url) => RedisRealtimeBus.connect(url, redisChannel),
          connectMongo: () => MongoChangeStreamBus.connect(connection, env),
          logger: new Logger("RealtimeModule"),
          describe: (bus) =>
            bus.name === "redis"
              ? `redis (${hostOf(config.get<string>("realtime.redisUrl"))}) · channel ${redisChannel}`
              : bus.name === "mongo-change-stream"
                ? `mongo change streams · env ${env}`
                : "in-memory (single instance only)",
        });
      },
    },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}

/** Log the host only, never credentials. */
function hostOf(url?: string): string {
  try {
    return url ? new URL(url).host : "?";
  } catch {
    return "?";
  }
}
