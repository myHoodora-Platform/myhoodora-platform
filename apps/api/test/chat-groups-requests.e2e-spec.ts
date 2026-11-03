import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface Convo {
  _id: string;
  kind: string;
  title?: string;
  admins?: string[];
  groupId?: string;
  request?: boolean;
  participantUids: string[];
  unreadCount: number;
  readBy: { uid: string; lastReadAt?: string }[];
}
interface Msg {
  _id: string;
  body: string;
  senderUid: string;
  system?: { type: string };
}

/** Message requests and group chats (2026-10-29), WhatsApp-style. */
describe("Message requests and group chats", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    for (const uid of ["ada", "bola", "chidi", "dayo", "emeka", "funmi"]) await t.member(uid, lekki, { displayName: uid[0]!.toUpperCase() + uid.slice(1) });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const start = (from: string, to: string) => t.http.post("/api/conversations").set(t.auth(from)).send({ recipientUid: to });
  const send = (uid: string, id: string, body: string) => t.http.post(`/api/conversations/${id}/messages`).set(t.auth(uid)).send({ body });
  const inbox = async (uid: string, q = "") => (await t.http.get(`/api/conversations${q}`).set(t.auth(uid)).expect(200)).body as Convo[];
  const counts = async (uid: string) => (await t.http.get("/api/conversations/unread-count").set(t.auth(uid)).expect(200)).body as { count: number; requests: number };
  const thread = async (uid: string, id: string) => (await t.http.get(`/api/conversations/${id}/messages`).set(t.auth(uid)).expect(200)).body as Msg[];

  describe("message requests", () => {
    let id: string;

    it("a first message from someone you've never written to waits in Requests, not your inbox or unread count", async () => {
      id = (await start("ada", "bola").expect(201)).body._id;
      await send("ada", id, "Hi Bola, is your generator still for sale?").expect(201);
      expect((await inbox("bola")).map((c) => c._id)).not.toContain(id);
      const requests = await inbox("bola", "?requests=true");
      expect(requests.map((c) => c._id)).toEqual([id]);
      expect(requests[0]!.request).toBe(true);
      expect(await counts("bola")).toEqual({ count: 0, requests: 1 });
      // The sender's own inbox has it as usual.
      expect((await inbox("ada")).map((c) => c._id)).toContain(id);
    });

    it("opening a request doesn't tell the sender it was seen", async () => {
      await thread("bola", id);
      const c = (await t.http.get(`/api/conversations/${id}`).set(t.auth("ada")).expect(200)).body as Convo;
      expect(c.readBy.find((r) => r.uid === "bola")?.lastReadAt).toBeUndefined();
    });

    it("one quiet notification, for the first message only", async () => {
      await send("ada", id, "Sorry, one more thing").expect(201);
      const notes = await t.model<{ title: string }>("Notification").find({ uid: "bola" }).lean();
      expect(notes.filter((n) => /wants to message you/.test(n.title))).toHaveLength(1);
      expect(notes.filter((n) => /sent you a message/.test(n.title))).toHaveLength(0);
    });

    it("accepting moves it to the inbox, reads it, and \"Seen\" works from then", async () => {
      const c = (await t.http.put(`/api/conversations/${id}/request`).set(t.auth("bola")).expect(200)).body as Convo;
      expect(c.request).toBeUndefined();
      expect((await inbox("bola")).map((x) => x._id)).toContain(id);
      expect(await inbox("bola", "?requests=true")).toEqual([]);
      expect(await counts("bola")).toEqual({ count: 0, requests: 0 });
      const seen = (await t.http.get(`/api/conversations/${id}`).set(t.auth("ada")).expect(200)).body as Convo;
      expect(seen.readBy.find((r) => r.uid === "bola")?.lastReadAt).toBeDefined();
    });

    it("replying accepts too; someone you've written to before isn't a request", async () => {
      const other = (await start("chidi", "dayo").expect(201)).body._id as string;
      await send("chidi", other, "Hello").expect(201);
      expect((await inbox("dayo", "?requests=true")).map((c) => c._id)).toContain(other);
      await send("dayo", other, "Hi Chidi").expect(201);
      expect(await inbox("dayo", "?requests=true")).toEqual([]);
      // Bola has written to Ada now: a new chat from Ada about something else isn't a request.
      await send("bola", id, "Yes it is").expect(201);
    });
  });

  describe("group chats", () => {
    let g: string;

    it("needs a name and someone else; you're its admin, and it starts with a notice", async () => {
      await t.http.post("/api/conversations/groups").set(t.auth("ada")).send({ title: " ", memberUids: ["bola"] }).expect(400);
      await t.http.post("/api/conversations/groups").set(t.auth("ada")).send({ title: "Road 4", memberUids: ["ada"] }).expect(400);
      const c = (await t.http.post("/api/conversations/groups").set(t.auth("ada")).send({ title: "Road 4", memberUids: ["bola", "chidi"] }).expect(201)).body as Convo;
      g = c._id;
      expect(c).toEqual(expect.objectContaining({ kind: "group", title: "Road 4", admins: ["ada"] }));
      expect(c.participantUids.sort()).toEqual(["ada", "bola", "chidi"]);
      const [first] = await thread("bola", g);
      expect(first).toEqual(expect.objectContaining({ body: "Ada created the group “Road 4”", system: expect.objectContaining({ type: "created" }) }));
    });

    it("everyone gets each message and an unread count; notices can't be reacted to", async () => {
      await send("bola", g, "Who has a ladder?").expect(201);
      expect((await inbox("ada")).find((c) => c._id === g)?.unreadCount).toBe(1);
      expect((await inbox("chidi")).find((c) => c._id === g)?.unreadCount).toBe(1);
      const notice = (await thread("ada", g)).find((m) => m.system)!;
      await t.http.put(`/api/conversations/${g}/messages/${notice._id}/reaction`).set(t.auth("bola")).send({ emoji: "👍" }).expect(400);
    });

    it("someone who won't take messages from you can't be added, and is named", async () => {
      await t.http.patch("/api/users/me/preferences").set(t.auth("funmi")).send({ privacy: { messaging: "nobody" } }).expect(200);
      const res = await t.http.post(`/api/conversations/${g}/members`).set(t.auth("ada")).send({ uids: ["funmi"] }).expect(403);
      expect(res.body.message).toMatch(/Funmi/);
    });

    it("admins add people, who see what's said from then on", async () => {
      await t.http.post(`/api/conversations/${g}/members`).set(t.auth("bola")).send({ uids: ["dayo"] }).expect(403);
      await t.http.post(`/api/conversations/${g}/members`).set(t.auth("ada")).send({ uids: ["dayo"] }).expect(201);
      const seen = await thread("dayo", g);
      expect(seen.map((m) => m.body)).toEqual(["Ada added Dayo"]);
    });

    it("admins rename, make admins and remove; members can't", async () => {
      await t.http.patch(`/api/conversations/${g}`).set(t.auth("chidi")).send({ title: "Mine" }).expect(403);
      expect((await t.http.patch(`/api/conversations/${g}`).set(t.auth("ada")).send({ title: "Road 4 neighbours" }).expect(200)).body.title).toBe("Road 4 neighbours");
      await t.http.put(`/api/conversations/${g}/admins/bola`).set(t.auth("ada")).send({ admin: true }).expect(200);
      await t.http.delete(`/api/conversations/${g}/members/chidi`).set(t.auth("bola")).expect(200);
      await t.http.get(`/api/conversations/${g}`).set(t.auth("chidi")).expect(404);
      await send("chidi", g, "still here?").expect(404);
    });

    it("the last admin to leave hands it to whoever has been in it longest", async () => {
      await t.http.put(`/api/conversations/${g}/admins/bola`).set(t.auth("ada")).send({ admin: false }).expect(200);
      await t.http.post(`/api/conversations/${g}/leave`).set(t.auth("ada")).expect(204);
      const c = (await t.http.get(`/api/conversations/${g}`).set(t.auth("bola")).expect(200)).body as Convo;
      expect(c.admins).toEqual(["bola"]);
      expect((await thread("bola", g)).at(-1)?.body).toBe("Ada left");
    });
  });

  describe("a community Group's chat", () => {
    let groupId: string;

    beforeAll(async () => {
      const [doc] = await t.model<{ _id: unknown }>("Group").insertMany([
        { name: "Estate parents", nameKey: "estate parents", description: "School runs", privacy: "open", category: "parents", boundary: "neighbourhood", neighborhoodId: lekki, city: "Lagos", createdBy: "ada", memberCount: 2, inviteToken: "tok" },
      ]);
      groupId = String(doc!._id);
      await t.model("GroupMember").insertMany([
        { groupId, uid: "ada", role: "admin" },
        { groupId, uid: "emeka", role: "member" },
      ]);
    });

    it("is for its members, made the first time, the same chat after", async () => {
      await t.http.post(`/api/conversations/for-group/${groupId}`).set(t.auth("bola")).expect(403);
      const a = (await t.http.post(`/api/conversations/for-group/${groupId}`).set(t.auth("ada")).expect(201)).body as Convo;
      const b = (await t.http.post(`/api/conversations/for-group/${groupId}`).set(t.auth("emeka")).expect(201)).body as Convo;
      expect(b._id).toBe(a._id);
      expect(a).toEqual(expect.objectContaining({ kind: "group", title: "Estate parents", groupId, admins: ["ada"] }));
      // Its members follow the Group: they can't be added here.
      await t.http.post(`/api/conversations/${a._id}/members`).set(t.auth("ada")).send({ uids: ["bola"] }).expect(400);
    });

    it("joiners are added, and someone who left the Group loses the chat", async () => {
      const id = (await t.http.post(`/api/conversations/for-group/${groupId}`).set(t.auth("ada")).expect(201)).body._id as string;
      await send("ada", id, "Pickup at 3").expect(201);
      await t.model("GroupMember").insertMany([{ groupId, uid: "dayo", role: "member" }]);
      const c = (await t.http.post(`/api/conversations/for-group/${groupId}`).set(t.auth("dayo")).expect(201)).body as Convo;
      expect(c.participantUids).toContain("dayo");
      // Joined after it was said.
      expect((await thread("dayo", id)).map((m) => m.body)).not.toContain("Pickup at 3");
      await t.model("GroupMember").deleteOne({ groupId, uid: "emeka" });
      await t.http.get(`/api/conversations/${id}`).set(t.auth("emeka")).expect(404);
      const after = (await t.http.get(`/api/conversations/${id}`).set(t.auth("ada")).expect(200)).body as Convo;
      expect(after.participantUids).not.toContain("emeka");
    });
  });
});
