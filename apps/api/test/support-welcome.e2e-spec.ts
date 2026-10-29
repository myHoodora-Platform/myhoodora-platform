import { CommunicationsService } from "../src/communications/communications.service";
import { InboundService } from "../src/inbound/inbound.service";
import { JobsService } from "../src/jobs/jobs.service";
import { PushService } from "../src/push/push.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface Thread {
  id: string;
  subject: string;
  topic: string;
  status: string;
  startedBy: string;
  unread: boolean;
  messages?: { from: string; body: string; by?: string }[];
}

/** The team's welcome to every new neighbour (contract §18, 2026-10-29). */
describe("The team's welcome to new neighbours", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    await t.member("admin1", lekki, { role: "admin", isOnboarded: true });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());
  afterEach(() => jest.restoreAllMocks());

  const jobs = () => t.model<{ type: string; payload: { uid: string }; runAt: Date; status: string }>("Job");
  const onboard = (uid: string, displayName = "Ada Okafor") => t.http.patch("/api/users/me/onboarding").set(t.auth(uid)).send({ displayName });
  /** Brings the queued welcomes forward and runs them, as the API would a few minutes later. */
  const runWelcomes = async () => {
    await jobs().updateMany({ type: "support.welcome", status: "queued" }, { $set: { runAt: new Date(Date.now() - 1000) } });
    await t.app.get(JobsService).drain();
  };
  const threads = async (uid: string) => (await t.http.get("/api/support/threads").set(t.auth(uid)).expect(200)).body as Thread[];
  const thread = async (uid: string, id: string) => (await t.http.get(`/api/support/threads/${id}`).set(t.auth(uid)).expect(200)).body as Thread;

  it("a few minutes after someone first finishes onboarding, the team welcomes them in the app and with a push, not by email", async () => {
    await t.user("ada");
    const pushed = jest.spyOn(t.app.get(PushService), "deliver");
    const emailed = jest.spyOn(t.app.get(CommunicationsService), "sendEmail");
    await onboard("ada").expect(200);

    const [job, ...more] = await jobs().find({ type: "support.welcome" }).lean();
    expect(more).toHaveLength(0);
    expect(job!.payload.uid).toBe("ada");
    // Not at once: the app registers the phone for pushes after onboarding (3 minutes by default).
    expect(job!.runAt.getTime()).toBeGreaterThan(Date.now() + 2 * 60_000);
    expect(await threads("ada")).toEqual([]);

    await runWelcomes();
    const [welcome, ...others] = await threads("ada");
    expect(others).toHaveLength(0);
    expect(welcome).toEqual(expect.objectContaining({ subject: "Welcome to myHoodora", topic: "welcome", startedBy: "staff", unread: true }));
    const [message] = (await thread("ada", welcome!.id)).messages!;
    expect(message).toEqual(expect.objectContaining({ from: "staff", by: "myHoodora team" }));
    expect(message!.body).toMatch(/^Hi Ada, welcome to myHoodora!/);
    // Not verified yet: the first step is their address.
    expect(message!.body).toMatch(/Confirm your address/);

    const notes = await t.model<{ type: string; title: string; href: string }>("Notification").find({ uid: "ada" }).lean();
    expect(notes).toEqual([expect.objectContaining({ type: "system", title: "Welcome to myHoodora", href: `/inbox/support/${welcome!.id}` })]);
    expect(pushed).toHaveBeenCalledWith(["ada"], expect.objectContaining({ title: "Welcome to myHoodora", href: `/inbox/support/${welcome!.id}` }));
    // They had the welcome email at sign-up.
    expect(emailed).not.toHaveBeenCalled();
  });

  it("only once: onboarding again, or the job running twice, adds nothing", async () => {
    await onboard("ada", "Ada O.").expect(200);
    expect(await jobs().countDocuments({ type: "support.welcome" })).toBe(1);
    await t.app.get(InboundService).sendWelcome("ada");
    expect(await threads("ada")).toHaveLength(1);
    expect(await t.model("Notification").countDocuments({ uid: "ada" })).toBe(1);
  });

  it("a neighbour whose address is already verified isn't asked to confirm it", async () => {
    await t.member("bola", lekki, { isOnboarded: false });
    await onboard("bola", "Bola Adeyemi").expect(200);
    await runWelcomes();
    const [welcome] = await threads("bola");
    const [message] = (await thread("bola", welcome!.id)).messages!;
    expect(message!.body).toMatch(/^Hi Bola, welcome/);
    expect(message!.body).not.toMatch(/Confirm your address/);
  });

  it("doesn't wait in the team's inbox, but a reply brings it there like any conversation", async () => {
    const [welcome] = await threads("ada");
    expect(welcome!.status).toBe("resolved");
    const inbox = async (status: string) => ((await t.http.get(`/api/admin/inbox?status=${status}`).set(t.auth("admin1")).expect(200)).body as { items: { id: string }[] }).items.map((i) => i.id);
    expect(await inbox("open")).not.toContain(welcome!.id);
    expect(await inbox("waiting")).not.toContain(welcome!.id);

    await t.http.post(`/api/support/threads/${welcome!.id}/messages`).set(t.auth("ada")).send({ body: "Thank you! How do I find my neighbourhood's group?" }).expect(200);
    expect(await inbox("open")).toContain(welcome!.id);
  });

  it("someone who deactivated before it was due gets nothing", async () => {
    await t.user("cara");
    await onboard("cara", "Cara Musa").expect(200);
    await t.users.updateOne({ uid: "cara" }, { $set: { deactivatedAt: new Date() } });
    await runWelcomes();
    expect(await t.model("InboundMessage").countDocuments({ uid: "cara" })).toBe(0);
    expect(await t.model("Notification").countDocuments({ uid: "cara" })).toBe(0);
  });
});

describe("The welcome, with SUPPORT_WELCOME=off", () => {
  let t: TestApp;

  beforeAll(async () => {
    process.env.SUPPORT_WELCOME = "off";
    t = await createTestApp();
  });
  afterAll(async () => {
    delete process.env.SUPPORT_WELCOME;
    await t.close();
  });

  it("isn't queued at all", async () => {
    await t.user("dayo");
    await t.http.patch("/api/users/me/onboarding").set(t.auth("dayo")).send({ displayName: "Dayo" }).expect(200);
    expect(await t.model("Job").countDocuments({ type: "support.welcome" })).toBe(0);
  });
});
