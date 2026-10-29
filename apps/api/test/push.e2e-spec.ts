import { NotificationsService } from "../src/notifications/notifications.service";
import { AccountLifecycle } from "../src/users/account-lifecycle";
import { MAX_DEVICES_PER_PERSON } from "../src/push/push.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Contract §30: phones register for push; every notification is pushed to the ones that want it. */
describe("Push to the mobile app", () => {
  let t: TestApp;
  let lekki: string;
  const devices = () => t.model<{ uid: string; token: string; platform: string }>("PushDevice");
  const register = (uid: string, token: string, platform = "android") => t.http.put("/api/push/devices").set(t.auth(uid)).send({ token, platform });
  const pushedTo = (token: string) => t.pushProvider.outbox.filter((m) => m.token === token);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    await t.member("ada", lekki);
    await t.member("bola", lekki);
    await t.member("quiet", lekki, { preferences: { notifications: { comments: { push: false, email: false } } } } as never);
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    t.resetThrottle();
    await t.pushSettled();
    t.pushProvider.outbox.length = 0;
    t.pushProvider.unregistered.clear();
    await devices().deleteMany({});
  });

  it("registers a phone, idempotently, and refuses a malformed request", async () => {
    await register("ada", "tok-ada").expect(204);
    await register("ada", "tok-ada", "ios").expect(204);
    expect(await devices().find({ uid: "ada" }).lean()).toEqual([expect.objectContaining({ token: "tok-ada", platform: "ios" })]);
    await register("ada", "tok-x", "windows").expect(400);
    await t.http.put("/api/push/devices").set(t.auth("ada")).send({ platform: "ios" }).expect(400);
    await t.http.put("/api/push/devices").send({ token: "tok-anon", platform: "ios" }).expect(401);
  });

  it("a phone moves to whoever signs in on it last; the previous person stops getting pushes there", async () => {
    await register("ada", "shared-phone").expect(204);
    await register("bola", "shared-phone").expect(204);
    expect(await devices().find({ token: "shared-phone" }).lean()).toEqual([expect.objectContaining({ uid: "bola" })]);
  });

  it("keeps at most a set number of phones per person, dropping the one unused longest", async () => {
    // Registration is rate-limited (10 a minute), so the limiter is reset between calls here.
    for (let i = 0; i <= MAX_DEVICES_PER_PERSON; i++) {
      t.resetThrottle();
      await register("ada", `tok-${i}`).expect(204);
    }
    const left = (await devices().find({ uid: "ada" }).lean()).map((d) => d.token);
    expect(left).toHaveLength(MAX_DEVICES_PER_PERSON);
    expect(left).not.toContain("tok-0");
  });

  it("logout removes only your own phone", async () => {
    await register("ada", "tok-ada").expect(204);
    await t.http.delete(`/api/push/devices/${encodeURIComponent("tok-ada")}`).set(t.auth("bola")).expect(204);
    expect(await devices().countDocuments({ token: "tok-ada" })).toBe(1);
    await t.http.delete(`/api/push/devices/${encodeURIComponent("tok-ada")}`).set(t.auth("ada")).expect(204);
    expect(await devices().countDocuments({ token: "tok-ada" })).toBe(0);
  });

  it("a comment on your post is pushed to your phone, with where to go when tapped", async () => {
    await register("ada", "tok-ada").expect(204);
    const post = await t.post("ada", { message: "Lost cat near the gate" });
    await t.http.post(`/api/posts/${post._id}/comments`).set(t.auth("bola")).send({ content: "I saw one by the pharmacy" }).expect(201);
    await t.pushSettled();
    expect(pushedTo("tok-ada")).toEqual([
      { token: "tok-ada", title: "bola commented on your post", body: "I saw one by the pharmacy", data: { href: `/p/${post._id}`, type: "comment" } },
    ]);
  });

  it("follows the person's push setting for the category; notices without one always go", async () => {
    await register("quiet", "tok-quiet").expect(204);
    const notifications = t.app.get(NotificationsService);
    await notifications.notify({ uids: ["quiet"], type: "comment", title: "Someone commented", href: "/p/1", category: "comments" });
    await notifications.notify({ uids: ["quiet"], type: "system", title: "Your account was restricted", href: "/settings" });
    await t.pushSettled();
    expect(pushedTo("tok-quiet").map((m) => m.title)).toEqual(["Your account was restricted"]);
  });

  it("uses the default setting for someone who never changed theirs (events are off by default)", async () => {
    await register("bola", "tok-bola").expect(204);
    const notifications = t.app.get(NotificationsService);
    await notifications.notify({ uids: ["bola"], type: "event", title: "Event tomorrow", href: "/p/2", category: "events" });
    await notifications.notify({ uids: ["bola"], type: "message", title: "New message", href: "/inbox/3", category: "messages" });
    await t.pushSettled();
    expect(pushedTo("tok-bola").map((m) => m.title)).toEqual(["New message"]);
  });

  it("drops a token the push service says is dead", async () => {
    await register("ada", "tok-dead").expect(204);
    t.pushProvider.unregistered.add("tok-dead");
    await t.app.get(NotificationsService).notify({ uids: ["ada"], type: "system", title: "Hello", href: "/" });
    await t.pushSettled();
    expect(await devices().countDocuments({ token: "tok-dead" })).toBe(0);
  });

  it("broadcasts are pushed too", async () => {
    await register("ada", "tok-ada").expect(204);
    await t.app.get(NotificationsService).notifyBulk({ uids: ["ada"], type: "system", title: "Water outage tomorrow", href: "/notifications", dedupeKey: (u) => `b1:${u}` });
    await t.pushSettled();
    expect(pushedTo("tok-ada").map((m) => m.title)).toEqual(["Water outage tomorrow"]);
  });

  it("sign out everywhere removes every phone", async () => {
    await register("ada", "tok-a1").expect(204);
    await register("ada", "tok-a2", "ios").expect(204);
    await t.http.post("/api/auth/logout-everywhere").set(t.auth("ada")).expect(204);
    expect(await devices().countDocuments({ uid: "ada" })).toBe(0);
  });

  it("account deletion removes their phones (and the dry run only counts them)", async () => {
    await register("bola", "tok-bola").expect(204);
    const accounts = t.app.get(AccountLifecycle);
    expect(await accounts.purge("bola", true)).toMatchObject({ pushDevices: 1 });
    expect(await devices().countDocuments({ uid: "bola" })).toBe(1);
    expect(await accounts.purge("bola", false)).toMatchObject({ pushDevices: 1 });
    expect(await devices().countDocuments({ uid: "bola" })).toBe(0);
  });
});
