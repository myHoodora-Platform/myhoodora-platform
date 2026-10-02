import { signWebhook, verifyWebhookSignature } from "../src/communications/webhook-signature";
import { createTestApp, WEBHOOK_SECRET, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Pull the raw token out of the verify link in the most recent email to `to`. */
function tokenFrom(t: TestApp, to: string): string {
  const mail = [...t.outbox].reverse().find((m) => m.to === to);
  const match = mail?.text.match(/verify-email\?token=([^\s"&]+)/);
  if (!match) throw new Error(`no verify link for ${to}`);
  return decodeURIComponent(match[1]);
}

describe("Email verification & communications", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  describe("registration", () => {
    it("Google sign-in to an account that already exists keeps it exactly as it was (no overwrite, no second account)", async () => {
      const hood = await t.hood("Surulere", 3.3569, 6.5, 1500);
      await t.member("zainab", hood, { displayName: "Zainab Bello", bio: "Baker on Adeniran Ogunsanya", isOnboarded: true, role: "moderator", provider: "password" } as never);
      const before = await t.users.findOne({ uid: "zainab" }).lean();
      const emailsBefore = t.outbox.length;

      // The same person (same Firebase uid) now arrives through Google. The token carries Google's name for them.
      const google = t.auth("zainab", { emailVerified: true, provider: "google.com" });
      const me = (await t.http.get("/api/users/me").set(google).expect(200)).body;
      expect(me).toMatchObject({ uid: "zainab", displayName: "Zainab Bello", bio: "Baker on Adeniran Ogunsanya", isOnboarded: true, role: "moderator", neighborhoodId: hood, verificationStatus: "verified" });
      await t.http.get("/api/users/me").set(google).expect(200);

      const after = await t.users.findOne({ uid: "zainab" }).lean();
      expect(await t.users.countDocuments({ uid: "zainab" })).toBe(1);
      expect(await t.users.countDocuments({ email: "zainab@test.dev" })).toBe(1);
      expect(String(after!._id)).toBe(String(before!._id));
      expect(after).toMatchObject({ displayName: "Zainab Bello", provider: "password", role: "moderator", neighborhoodId: hood, isOnboarded: true });
      expect((after as { createdAt?: Date }).createdAt).toEqual((before as { createdAt?: Date }).createdAt);
      // No welcome email for a returning neighbour. The one thing Google adds: the address counts as confirmed.
      expect(t.outbox.length).toBe(emailsBefore);
      expect(me.emailVerified).toBe(true);

      // Going back to the password afterwards changes nothing either.
      const again = (await t.http.get("/api/users/me").set(t.auth("zainab")).expect(200)).body;
      expect(again).toMatchObject({ displayName: "Zainab Bello", isOnboarded: true, emailVerified: true });
    });

    it("sends exactly one welcome email with a verify link, never on later sign-ins", async () => {
      await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      const mails = t.outbox.filter((m) => m.to === "kemi@test.dev");
      expect(mails).toHaveLength(1);
      expect(mails[0].text).toContain("https://app.test/verify-email?token=");
      const me = await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      expect(me.body.emailVerified).toBe(false);
    });

    it("never stores the raw token", async () => {
      const raw = tokenFrom(t, "kemi@test.dev");
      const rows = await t.model<{ tokenHash: string }>("EmailVerification").find({ uid: "kemi" }).lean();
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(raw);
    });

    it("marks Google sign-ups verified immediately", async () => {
      const me = await t.http.get("/api/users/me").set(t.auth("gina", { emailVerified: true, provider: "google.com" })).expect(200);
      expect(me.body.emailVerified).toBe(true);
    });
  });

  describe("confirm", () => {
    it("verifies once; reuse and garbage get the same generic 400", async () => {
      const raw = tokenFrom(t, "kemi@test.dev");
      await t.http.post("/api/auth/email-verification/confirm").send({ token: raw }).expect(204);
      const me = await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      expect(me.body.emailVerified).toBe(true);

      const reuse = await t.http.post("/api/auth/email-verification/confirm").send({ token: raw }).expect(400);
      const junk = await t.http.post("/api/auth/email-verification/confirm").send({ token: "x".repeat(43) }).expect(400);
      expect(reuse.body.message).toBe(junk.body.message);
    });

    it("rejects expired tokens", async () => {
      await t.http.get("/api/users/me").set(t.auth("late")).expect(200);
      const raw = tokenFrom(t, "late@test.dev");
      await t.model("EmailVerification").updateMany({ uid: "late" }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      await t.http.post("/api/auth/email-verification/confirm").send({ token: raw }).expect(400);
    });
  });

  describe("resend", () => {
    it("invalidates the old link and is rate-limited (3 links an hour)", async () => {
      await t.http.get("/api/users/me").set(t.auth("remi")).expect(200);
      const first = tokenFrom(t, "remi@test.dev");
      await t.http.post("/api/auth/email-verification/resend").set(t.auth("remi")).expect(202);
      const second = tokenFrom(t, "remi@test.dev");
      expect(second).not.toBe(first);
      await t.http.post("/api/auth/email-verification/confirm").send({ token: first }).expect(400);

      await t.http.post("/api/auth/email-verification/resend").set(t.auth("remi")).expect(202);
      await t.http.post("/api/auth/email-verification/resend").set(t.auth("remi")).expect(429);
    });
  });

  describe("Resend webhook", () => {
    const post = (body: object, opts: { id?: string; ts?: number; secret?: string } = {}) => {
      const raw = JSON.stringify(body);
      const id = opts.id ?? `msg_${Math.random().toString(36).slice(2)}`;
      const ts = opts.ts ?? Math.floor(Date.now() / 1000);
      return t.http
        .post("/api/webhooks/resend")
        .set("content-type", "application/json")
        .set("svix-id", id)
        .set("svix-timestamp", String(ts))
        .set("svix-signature", signWebhook(opts.secret ?? WEBHOOK_SECRET, id, ts, raw))
        .send(raw);
    };
    const comms = () => t.model<{ type: string; status: string; providerMessageId: string }>("Communication");

    it("rejects a bad signature, a wrong secret and a stale timestamp", async () => {
      const body = { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "x" } };
      await t.http.post("/api/webhooks/resend").set("svix-id", "a").set("svix-timestamp", String(Math.floor(Date.now() / 1000))).set("svix-signature", "v1,AAAA").send(body).expect(400);
      await post(body, { secret: "whsec_" + Buffer.from("another-secret").toString("base64") }).expect(400);
      await post(body, { ts: Math.floor(Date.now() / 1000) - 3600 }).expect(400);
    });

    it("applies delivery events once and never moves status backwards", async () => {
      const row = await comms().findOne({ type: "welcome_verify" }).lean();
      const emailId = row!.providerMessageId;
      const delivered = { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: emailId } };

      const a = await post(delivered, { id: "evt_1" }).expect(200);
      expect(a.body.result).toBe("applied");
      const dup = await post(delivered, { id: "evt_1" }).expect(200);
      expect(dup.body.result).toBe("duplicate");
      await post({ type: "email.sent", created_at: new Date().toISOString(), data: { email_id: emailId } }).expect(200);
      expect((await comms().findOne({ providerMessageId: emailId }).lean())?.status).toBe("delivered");

      await post({ type: "email.bounced", created_at: new Date().toISOString(), data: { email_id: emailId } }).expect(200);
      await post({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: emailId } }).expect(200);
      expect((await comms().findOne({ providerMessageId: emailId }).lean())?.status).toBe("bounced");
    });

    it("acknowledges unknown messages and event types without error", async () => {
      const r = await post({ type: "email.opened", created_at: new Date().toISOString(), data: { email_id: "nope" } }).expect(200);
      expect(r.body.result).toBe("ignored");
      const u = await post({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "nope" } }).expect(200);
      expect(u.body.result).toBe("unknown");
    });
  });

  describe("signature verifier", () => {
    it("accepts any matching v1 signature in the header (key rotation)", () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = signWebhook(WEBHOOK_SECRET, "id1", ts, "{}");
      expect(() => verifyWebhookSignature(WEBHOOK_SECRET, "{}", { id: "id1", timestamp: String(ts), signature: `v1,bogus ${sig}` })).not.toThrow();
      expect(() => verifyWebhookSignature(WEBHOOK_SECRET, "{ }", { id: "id1", timestamp: String(ts), signature: sig })).toThrow();
    });
  });
});
