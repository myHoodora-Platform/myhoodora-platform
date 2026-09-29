import { INestApplication, ValidationPipe } from "@nestjs/common";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import type { Connection, Model } from "mongoose";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import type { LogEmailAdapter } from "../../src/communications/providers/log-email.adapter";
import { EMAIL_PROVIDER } from "../../src/communications/providers/providers";
import { Neighborhood } from "../../src/hoods/schemas/hood.schema";
import { User } from "../../src/users/schemas/user.schema";

export const WEBHOOK_SECRET = "whsec_" + Buffer.from("test-webhook-secret-32-bytes-long!!").toString("base64");

/**
 * Boots the real AppModule against its own database on the test replica set.
 * Firebase is the only stub (see firebase-mock.ts). Guards, pipes, services,
 * Mongo transactions and unique indexes all run for real.
 */
export async function createTestApp(): Promise<TestApp> {
  const base = process.env.TEST_MONGO_URI!;
  const dbName = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const url = new URL(base);
  url.pathname = `/${dbName}`;
  process.env.MONGODB_URI = url.toString();
  process.env.RESEND_API_KEY = "";
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.APP_URL = "https://app.test";

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ["error"] });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const conn = app.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(conn.models).map((m) => m.syncIndexes()));
  return new TestApp(app);
}

export class TestApp {
  constructor(readonly app: INestApplication) {}

  get http() {
    return request(this.app.getHttpServer());
  }

  get users(): Model<User> {
    return this.app.get(getModelToken(User.name));
  }

  get hoods(): Model<Neighborhood> {
    return this.app.get(getModelToken(Neighborhood.name));
  }

  get outbox() {
    return (this.app.get(EMAIL_PROVIDER) as LogEmailAdapter).outbox;
  }

  model<T>(name: string): Model<T> {
    return this.app.get(getModelToken(name));
  }

  auth(uid: string, opts: { emailVerified?: boolean; provider?: string } = {}) {
    return { Authorization: `Bearer t:${uid}:${opts.emailVerified ? "v" : "u"}:${opts.provider ?? "password"}` };
  }

  async hood(name = "Lekki Phase 1", lng = 3.4746, lat = 6.4478, radiusMeters = 2000): Promise<string> {
    const h = await this.hoods.create({ name, city: "Lagos", country: "Nigeria", location: { type: "Point", coordinates: [lng, lat] }, radiusMeters, status: "active" });
    return String(h._id);
  }

  async user(uid: string, patch: Partial<User> = {}): Promise<string> {
    await this.users.create({ uid, email: `${uid}@test.dev`, displayName: uid, ...patch });
    return uid;
  }

  async member(uid: string, hoodId: string, patch: Partial<User> = {}): Promise<string> {
    return this.user(uid, { neighborhoodId: hoodId, verificationStatus: "verified", verifiedAt: new Date(), ...patch });
  }

  async post(uid: string, body: Record<string, unknown> = { message: "Hello neighbours" }) {
    const res = await this.http.post("/api/posts").set(this.auth(uid)).send(body);
    if (res.status !== 201) throw new Error(`post failed ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { _id: string };
  }

  /** Rate limits are per IP and every test request shares one; call between cases that hit strict routes. */
  resetThrottle() {
    (this.app.get(ThrottlerStorage) as unknown as { storage: Map<string, unknown> }).storage.clear();
  }

  close() {
    return this.app.close();
  }
}
