import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from "jose";
import { verifyWebhookSignature } from "../src/communications/webhook-signature";
import { pairwiseSubject } from "../src/oauth/domain/crypto";
import { Job } from "../src/jobs/job.schema";
import { JobsService } from "../src/jobs/jobs.service";
import { EVENT_JOB } from "../src/oauth/integration-events.service";
import { IntegrationLink } from "../src/oauth/oauth.schemas";
import { AccountLifecycle } from "../src/users/account-lifecycle";
import { StaffUsersService } from "../src/users/staff-users.service";
import type { Viewer } from "../src/shared/auth/viewer";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock(
  "../src/config/firebase.config",
  () => jest.requireActual("./helpers/firebase-mock").firebaseMock,
);

/** Account events to myHoodora AI and its subject lookup: docs/integrations/myhoodora-ai.md §§7–8. */

const ISSUER = "https://api.test";
const CLIENT = "myhoodora-ai";
const PAIRWISE = "test-pairwise-secret-at-least-32-characters";
const SECRET = `whsec_${randomBytes(32).toString("base64")}`;

interface Received {
  headers: http.IncomingHttpHeaders;
  body: string;
  event: {
    id: string;
    type: string;
    version: number;
    occurred_at: string;
    data: Record<string, unknown>;
  };
}

/** Stands in for myHoodora AI's event receiver: records what arrives, answers `status`. */
function receiver() {
  const received: Received[] = [];
  const state = { status: 200 };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body, event: JSON.parse(body) });
      res.writeHead(state.status).end();
    });
  });
  return { server, received, state };
}

/** Polls until `find` gives something (it may be async). */
async function waitFor<T>(
  find: () => T | undefined | null | Promise<T | undefined | null>,
  ms = 5_000,
): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const found = await find();
    if (found !== undefined && found !== null) return found;
    if (Date.now() > until) throw new Error("Timed out waiting");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const settle = () => new Promise((r) => setTimeout(r, 400));

describe("Account events to myHoodora AI", () => {
  let t: TestApp;
  let ai: ReturnType<typeof receiver>;
  let clientKey: KeyLike;
  const saved = { ...process.env };

  beforeAll(async () => {
    ai = receiver();
    await new Promise<void>((resolve) =>
      ai.server.listen(0, "127.0.0.1", resolve),
    );
    const server = await generateKeyPair("ES256", { extractable: true });
    const client = await generateKeyPair("ES256", { extractable: true });
    clientKey = client.privateKey;
    const clientPublic: JWK = {
      ...(await exportJWK(client.publicKey)),
      kid: "ai-test",
      alg: "ES256",
    };
    Object.assign(process.env, {
      AI_INTEGRATION_ENABLED: "true",
      OIDC_ISSUER: ISSUER,
      OIDC_SIGNING_KEYS: JSON.stringify({
        keys: [{ ...(await exportJWK(server.privateKey)), kid: "srv" }],
      }),
      OIDC_PAIRWISE_SECRET: PAIRWISE,
      AI_CLIENT_REDIRECT_URIS: "https://studio.test/auth/myhoodora/callback",
      AI_CLIENT_JWKS: JSON.stringify({ keys: [clientPublic] }),
      AI_EVENTS_URL: `http://127.0.0.1:${(ai.server.address() as AddressInfo).port}/events`,
      AI_EVENTS_SECRET: SECRET,
    });
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
    await new Promise((r) => ai.server.close(r));
    process.env = saved;
  });
  beforeEach(() => {
    t.resetThrottle();
    ai.received.length = 0;
    ai.state.status = 200;
  });

  /** Someone who has signed in to myHoodora AI (the link a token exchange leaves behind). */
  async function linked(
    uid: string,
    patch: Parameters<TestApp["user"]>[1] = {},
  ) {
    await t.user(uid, { emailVerifiedAt: new Date(), ...patch });
    const sub = pairwiseSubject(PAIRWISE, CLIENT, uid);
    await t
      .model<IntegrationLink>(IntegrationLink.name)
      .create({
        clientId: CLIENT,
        uid,
        sub,
        firstAt: new Date(),
        lastAt: new Date(),
      });
    return sub;
  }
  const jobs = () => t.model<Job>(Job.name);
  const eventOf = (type: string, sub: string) => () =>
    ai.received.find((r) => r.event.type === type && r.event.data.sub === sub);

  it("deactivating sends a signed account.updated with the state, and nothing that identifies the person here", async () => {
    const sub = await linked("ada");
    await t.http
      .post("/api/users/me/deactivate")
      .set(t.auth("ada", { emailVerified: true }))
      .send({ reason: "moved", mode: "deactivate" })
      .expect(204);

    const got = await waitFor(eventOf("account.updated", sub));
    // Signed exactly as the contract says (Standard Webhooks), checked with the platform's own verifier.
    expect(() =>
      verifyWebhookSignature(SECRET, got.body, {
        id: String(got.headers["webhook-id"]),
        timestamp: String(got.headers["webhook-timestamp"]),
        signature: String(got.headers["webhook-signature"]),
      }),
    ).not.toThrow();
    expect(got.headers["webhook-id"]).toBe(got.event.id);
    expect(got.event).toMatchObject({
      type: "account.updated",
      version: 1,
      data: {
        sub,
        status: "deactivated",
        email: "ada@test.dev",
        email_verified: true,
        age_band: "adult",
      },
    });
    expect(Date.parse(got.event.occurred_at)).not.toBeNaN();
    expect(got.body).not.toContain('"ada"');
    // Deactivating also ends every session.
    await waitFor(eventOf("account.sessions_revoked", sub));
  });

  it("“sign out everywhere” sends account.sessions_revoked", async () => {
    const sub = await linked("bola");
    await t.http
      .post("/api/auth/logout-everywhere")
      .set(t.auth("bola", { emailVerified: true }))
      .expect(204);
    const got = await waitFor(eventOf("account.sessions_revoked", sub));
    expect(got.event.data).toEqual({ sub, revoked_at: got.event.occurred_at });
  });

  it("a staff suspension and its end are both sent", async () => {
    const sub = await linked("chidi");
    const staff = {
      uid: "staff-1",
      role: "admin",
      displayName: "Staff",
      capabilities: ["moderation.suspend"],
    } as unknown as Viewer;
    await t.app
      .get(StaffUsersService)
      .act(staff, "chidi", { action: "suspend", reason: "test" });
    expect(
      (await waitFor(eventOf("account.updated", sub))).event.data.status,
    ).toBe("suspended");
    ai.received.length = 0;
    await t.app
      .get(StaffUsersService)
      .act(staff, "chidi", { action: "reinstate", reason: "test" });
    expect(
      (await waitFor(eventOf("account.updated", sub))).event.data.status,
    ).toBe("active");
  });

  it("deleting an account sends account.deleted with the subject, then forgets the link", async () => {
    const sub = await linked("dayo");
    await t.app.get(AccountLifecycle).purge("dayo", false);
    const got = await waitFor(eventOf("account.deleted", sub));
    expect(got.event.data).toEqual({ sub, deleted_at: got.event.occurred_at });
    expect(
      await t
        .model<IntegrationLink>(IntegrationLink.name)
        .countDocuments({ uid: "dayo" }),
    ).toBe(0);
  });

  it("someone who never signed in to myHoodora AI causes no events", async () => {
    await t.user("never", { emailVerifiedAt: new Date() });
    await t.http
      .post("/api/auth/logout-everywhere")
      .set(t.auth("never", { emailVerified: true }))
      .expect(204);
    await settle();
    expect(ai.received).toHaveLength(0);
    expect(
      await jobs().countDocuments({ type: EVENT_JOB, "payload.uid": "never" }),
    ).toBe(0);
  });

  it("a failed delivery is tried again a minute later, as the same event", async () => {
    const sub = await linked("emeka");
    ai.state.status = 503;
    await t.http
      .post("/api/auth/logout-everywhere")
      .set(t.auth("emeka", { emailVerified: true }))
      .expect(204);
    const first = await waitFor(eventOf("account.sessions_revoked", sub));

    const retry = await waitFor(() =>
      jobs()
        .findOne({
          type: EVENT_JOB,
          "payload.uid": "emeka",
          "payload.attempt": 2,
        })
        .lean<Job>()
        .exec(),
    );
    expect(retry.status).toBe("queued");
    expect(retry.runAt.getTime() - Date.now()).toBeGreaterThan(50_000);
    expect(retry.runAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);

    // A minute on, the receiver is back: the same event (same id, same moment) arrives again.
    ai.received.length = 0;
    ai.state.status = 204;
    await jobs().updateOne(
      { type: EVENT_JOB, "payload.uid": "emeka", "payload.attempt": 2 },
      { $set: { runAt: new Date(Date.now() - 1000) } },
    );
    await t.app.get(JobsService).drain();
    const second = await waitFor(eventOf("account.sessions_revoked", sub));
    expect(second.event).toEqual(first.event);
    expect(
      await jobs().countDocuments({
        type: EVENT_JOB,
        "payload.uid": "emeka",
        "payload.attempt": 3,
      }),
    ).toBe(0);
  });

  it("an event the receiver refuses (4xx it will always refuse) is not retried", async () => {
    const sub = await linked("funmi");
    ai.state.status = 400;
    await t.http
      .post("/api/auth/logout-everywhere")
      .set(t.auth("funmi", { emailVerified: true }))
      .expect(204);
    await waitFor(eventOf("account.sessions_revoked", sub));
    await settle();
    expect(
      await jobs().countDocuments({
        type: EVENT_JOB,
        "payload.uid": "funmi",
        "payload.attempt": 2,
      }),
    ).toBe(0);
  });

  describe("GET /api/v1/integrations/ai/subjects/:sub", () => {
    const API = `${ISSUER}/api/v1/integrations/ai`;
    const assertion = (
      patch: { aud?: string; key?: KeyLike; iss?: string } = {},
    ) => {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: "ai-test" })
        .setIssuer(patch.iss ?? CLIENT)
        .setSubject(CLIENT)
        .setAudience(patch.aud ?? API)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .setJti(randomUUID())
        .sign(patch.key ?? clientKey);
    };
    const lookup = (sub: string, token?: string) => {
      const req = t.http.get(
        `/api/v1/integrations/ai/subjects/${encodeURIComponent(sub)}`,
      );
      return token === undefined
        ? req
        : req.set("Authorization", `Bearer ${token}`);
    };

    it("answers the account's current state, uncached, for the client that proves itself", async () => {
      const sub = await linked("gbenga", { accountStatus: "suspended" });
      const res = await lookup(sub, await assertion()).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toEqual({
        sub,
        status: "suspended",
        email: "gbenga@test.dev",
        email_verified: true,
        age_band: "adult",
        updated_at: expect.any(String),
      });
    });

    it("says deactivated for a deactivated account", async () => {
      const sub = await linked("hauwa", { deactivatedAt: new Date() });
      expect(
        (await lookup(sub, await assertion()).expect(200)).body.status,
      ).toBe("deactivated");
    });

    it("refuses without a client assertion, with one meant for the token endpoint, or one used twice", async () => {
      const sub = await linked("ify");
      expect((await lookup(sub).expect(401)).body).toMatchObject({
        statusCode: 401,
        code: "invalid_client",
      });
      await lookup(sub, "not-a-jwt").expect(401);
      await lookup(
        sub,
        await assertion({ aud: `${ISSUER}/api/v1/oauth/token` }),
      ).expect(401);
      const { privateKey } = await generateKeyPair("ES256");
      await lookup(sub, await assertion({ key: privateKey })).expect(401);
      const once = await assertion();
      await lookup(sub, once).expect(200);
      await lookup(sub, once).expect(401);
    });

    it("answers 404 for a subject nobody has, or one whose account has been deleted", async () => {
      expect(
        (await lookup("no-such-subject", await assertion()).expect(404)).body
          .code,
      ).toBe("unknown_subject");
      const sub = await linked("jide");
      await t.app.get(AccountLifecycle).purge("jide", false);
      await lookup(sub, await assertion()).expect(404);
    });
  });
});
