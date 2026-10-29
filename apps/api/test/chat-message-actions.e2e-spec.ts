import { Types } from "mongoose";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Reply, react, edit and delete for everyone (2026-10-28), WhatsApp's message actions. */
describe("Message actions", () => {
  let t: TestApp;
  let convo: string;
  const send = (uid: string, body: Record<string, unknown>) => t.http.post(`/api/conversations/${convo}/messages`).set(t.auth(uid)).send(body);
  const react = (uid: string, mid: string, emoji: string | null) => t.http.put(`/api/conversations/${convo}/messages/${mid}/reaction`).set(t.auth(uid)).send({ emoji });
  const thread = async (uid: string) => (await t.http.get(`/api/conversations/${convo}/messages`).set(t.auth(uid)).expect(200)).body as { _id: string; body: string; replyTo?: unknown; reactions?: unknown; editedAt?: string; deleted?: boolean }[];
  // Straight to the collection: Mongoose won't change a createdAt.
  const age = (mid: string, minutes: number) => t.model("Message").collection.updateOne({ _id: new Types.ObjectId(mid) }, { $set: { createdAt: new Date(Date.now() - minutes * 60_000) } });

  beforeAll(async () => {
    t = await createTestApp();
    const lekki = await t.hood("Lekki Phase 1");
    await t.member("ada", lekki);
    await t.member("bola", lekki);
    await t.member("chidi", lekki);
    await t.member("dayo", lekki);
    convo = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "bola" }).expect(201)).body._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("replies quote the message they answer, and only one from the same conversation", async () => {
    const q = (await send("ada", { body: "Is the generator still for sale?" }).expect(201)).body;
    const a = (await send("bola", { body: "Yes, come by at 5", replyTo: q._id }).expect(201)).body;
    expect(a.replyTo).toEqual({ _id: q._id, senderUid: "ada", body: "Is the generator still for sale?", photo: false, deleted: false });
    const other = (await t.http.post("/api/conversations").set(t.auth("chidi")).send({ recipientUid: "ada" }).expect(201)).body._id;
    const elsewhere = (await t.http.post(`/api/conversations/${other}/messages`).set(t.auth("chidi")).send({ body: "hi" }).expect(201)).body._id;
    await send("bola", { body: "sneaky", replyTo: elsewhere }).expect(400);
  });

  it("one reaction each: a new one replaces yours, null takes it back; words aren't reactions", async () => {
    const m = (await send("ada", { body: "Thanks!" }).expect(201)).body._id;
    await react("bola", m, "👍🏽").expect(200);
    await react("ada", m, "👍🏽").expect(200);
    let r = (await react("bola", m, "❤️").expect(200)).body;
    expect(r.reactions).toEqual([
      { emoji: "👍🏽", uids: ["ada"] },
      { emoji: "❤️", uids: ["bola"] },
    ]);
    r = (await react("bola", m, null).expect(200)).body;
    expect(r.reactions).toEqual([{ emoji: "👍🏽", uids: ["ada"] }]);
    for (const bad of ["lol", "👍 nice", "<b>", "a"]) await react("bola", m, bad).expect(400);
    await react("bola", m, "👨‍👩‍👧").expect(200);
    await react("bola", m, "🇳🇬").expect(200);
    // Not a member of the conversation.
    await react("chidi", m, "👍").expect(404);
  });

  it("the sender hears about a reaction, once per message", async () => {
    const m = (await send("ada", { body: "Meeting at 6?" }).expect(201)).body._id;
    await react("bola", m, "👍").expect(200);
    await react("bola", m, "🙏").expect(200);
    const notes = await t.model("Notification").find({ uid: "ada", title: /reacted/, body: "Meeting at 6?" }).lean<{ title: string }[]>();
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes.at(-1)!.title).toMatch(/^bola reacted (👍|🙏) to your message$/);
  });

  it("you can edit your own words for 15 minutes; it shows as edited", async () => {
    const m = (await send("ada", { body: "See you at 5" }).expect(201)).body._id;
    const edited = (await t.http.patch(`/api/conversations/${convo}/messages/${m}`).set(t.auth("ada")).send({ body: "See you at 6" }).expect(200)).body;
    expect(edited).toMatchObject({ body: "See you at 6" });
    expect(edited.editedAt).toBeDefined();
    await t.http.patch(`/api/conversations/${convo}/messages/${m}`).set(t.auth("bola")).send({ body: "hacked" }).expect(403);
    await age(m, 16);
    await t.http.patch(`/api/conversations/${convo}/messages/${m}`).set(t.auth("ada")).send({ body: "too late" }).expect(403);
  });

  it("delete for everyone: your own, within 2 days and 12 hours; everyone sees it was deleted, the inbox too", async () => {
    const m = (await send("ada", { body: "Wrong chat, sorry" }).expect(201)).body._id;
    await react("bola", m, "😂").expect(200);
    await t.http.delete(`/api/conversations/${convo}/messages/${m}`).set(t.auth("bola")).expect(403);
    const gone = (await t.http.delete(`/api/conversations/${convo}/messages/${m}`).set(t.auth("ada")).expect(200)).body;
    expect(gone).toMatchObject({ body: "", deleted: true });
    expect(gone.reactions).toBeUndefined();
    const seen = (await thread("bola")).find((x) => x._id === m)!;
    expect(seen).toMatchObject({ body: "", deleted: true });
    const inbox = await t.http.get("/api/conversations").set(t.auth("bola")).expect(200);
    expect(inbox.body.find((c: { _id: string }) => c._id === convo).lastMessage.body).toBe("🚫 This message was deleted");
    await react("bola", m, "👍").expect(410);
    // A reply to it says so, without its words.
    const reply = (await send("bola", { body: "?", replyTo: m }).expect(201)).body;
    expect(reply.replyTo).toMatchObject({ deleted: true, body: "" });
    // Seen hours ago, still in time (WhatsApp); not after 60 hours.
    const recent = (await send("ada", { body: "yesterday's news" }).expect(201)).body._id;
    await age(recent, 24 * 60);
    await t.http.delete(`/api/conversations/${convo}/messages/${recent}`).set(t.auth("ada")).expect(200);
    const old = (await send("ada", { body: "old news" }).expect(201)).body._id;
    await age(old, 61 * 60);
    await t.http.delete(`/api/conversations/${convo}/messages/${old}`).set(t.auth("ada")).expect(403);
  });

  it("delete for me: gone for you only, any message; your inbox shows the one before until something new", async () => {
    const hide = (uid: string, mid: string) => t.http.put(`/api/conversations/${convo}/messages/${mid}/hidden`).set(t.auth(uid));
    const inboxLine = async (uid: string) => ((await t.http.get("/api/conversations").set(t.auth(uid)).expect(200)).body as { _id: string; lastMessage?: { body: string } }[]).find((c) => c._id === convo)?.lastMessage?.body;
    await send("bola", { body: "Before" }).expect(201);
    const m = (await send("ada", { body: "Only Bola hides this" }).expect(201)).body._id;
    await hide("bola", m).expect(204);
    expect((await thread("bola")).some((x) => x._id === m)).toBe(false);
    expect((await thread("ada")).some((x) => x._id === m)).toBe(true);
    expect(await inboxLine("bola")).toBe("Before");
    expect(await inboxLine("ada")).toBe("Only Bola hides this");
    // Your own, too, and a deleted one.
    const mine = (await send("bola", { body: "typo" }).expect(201)).body._id;
    await hide("bola", mine).expect(204);
    expect(await inboxLine("bola")).toBe("Before");
    await send("ada", { body: "Something new" }).expect(201);
    expect(await inboxLine("bola")).toBe("Something new");
    await hide("chidi", m).expect(404);
  });

  it("forwards to up to 5 chats or neighbours, marked forwarded; one chat at a time once forwarded many times", async () => {
    const withChidi = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "chidi" }).expect(201)).body._id;
    const m = (await send("bola", { body: "Water is back on Admiralty Way", photos: [] }).expect(201)).body._id;
    const fwd = (body: Record<string, unknown>, mid = m, uid = "ada") => t.http.post(`/api/conversations/${convo}/messages/${mid}/forward`).set(t.auth(uid)).send(body);
    const res = (await fwd({ conversationIds: [withChidi], recipientUids: ["dayo"] }).expect(201)).body;
    expect(res.sent).toHaveLength(2);
    expect(res.failed).toEqual([]);
    const there = (await t.http.get(`/api/conversations/${withChidi}/messages`).set(t.auth("chidi")).expect(200)).body as { body: string; senderUid: string; forwarded?: boolean; forwardedManyTimes?: boolean }[];
    expect(there.at(-1)).toMatchObject({ body: "Water is back on Admiralty Way", senderUid: "ada", forwarded: true });
    expect(there.at(-1)!.forwardedManyTimes).toBeUndefined();
    // Someone else's words: not yours to edit.
    const copy = (there.at(-1) as unknown as { _id: string })._id;
    await t.http.patch(`/api/conversations/${withChidi}/messages/${copy}`).set(t.auth("ada")).send({ body: "changed" }).expect(403);
    // The original isn't marked.
    expect((await thread("ada")).find((x) => x._id === m)).not.toHaveProperty("forwarded");
    await fwd({}).expect(400);
    await fwd({ recipientUids: ["a", "b", "c", "d", "e", "f"] }).expect(400);
    // Not your chat: not your message to forward, nor theirs to forward into.
    await fwd({ conversationIds: [withChidi] }, m, "chidi").expect(404);
    const res2 = (await fwd({ conversationIds: [new Types.ObjectId().toHexString()] }).expect(201)).body;
    expect(res2.failed).toHaveLength(1);
    // Passed on 5 times already: one chat at a time, and it says so.
    await t.model("Message").collection.updateOne({ _id: new Types.ObjectId(m) }, { $set: { forwards: 5 } });
    expect((await thread("ada")).find((x) => x._id === m)).toMatchObject({ forwarded: true, forwardedManyTimes: true });
    await fwd({ conversationIds: [withChidi], recipientUids: ["dayo"] }).expect(400);
    await fwd({ conversationIds: [withChidi] }).expect(201);
    const gone = (await send("bola", { body: "oops" }).expect(201)).body._id;
    await t.http.delete(`/api/conversations/${convo}/messages/${gone}`).set(t.auth("bola")).expect(200);
    await fwd({ conversationIds: [withChidi] }, gone).expect(410);
  });
  it("pins a chat to the top of your inbox, up to three, only for you", async () => {
    const others: string[] = [];
    for (const uid of ["p1", "p2", "p3"]) {
      await t.member(uid, (await t.model("User").findOne({ uid: "ada" }).lean<{ neighborhoodId: string }>())!.neighborhoodId);
      const c = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: uid }).expect(201)).body._id;
      await t.http.post(`/api/conversations/${c}/messages`).set(t.auth("ada")).send({ body: "hi" }).expect(201);
      others.push(c);
    }
    // The chat with bola is older than the three new ones: pinning brings it to the top.
    await t.http.put(`/api/conversations/${convo}/pin`).set(t.auth("ada")).send({ pinned: true }).expect(200);
    let inbox = (await t.http.get("/api/conversations").set(t.auth("ada")).expect(200)).body as { _id: string; pinned: boolean }[];
    expect(inbox[0]).toMatchObject({ _id: convo, pinned: true });
    // Bola doesn't see it pinned.
    const theirs = (await t.http.get("/api/conversations").set(t.auth("bola")).expect(200)).body as { _id: string; pinned: boolean }[];
    expect(theirs.find((c) => c._id === convo)!.pinned).toBe(false);
    await t.http.put(`/api/conversations/${others[0]}/pin`).set(t.auth("ada")).send({ pinned: true }).expect(200);
    await t.http.put(`/api/conversations/${others[1]}/pin`).set(t.auth("ada")).send({ pinned: true }).expect(200);
    await t.http.put(`/api/conversations/${others[2]}/pin`).set(t.auth("ada")).send({ pinned: true }).expect(409);
    await t.http.put(`/api/conversations/${convo}/pin`).set(t.auth("ada")).send({ pinned: false }).expect(200);
    inbox = (await t.http.get("/api/conversations").set(t.auth("ada")).expect(200)).body;
    expect(inbox.filter((c) => c.pinned).map((c) => c._id)).toEqual([others[1], others[0]]);
  });

  it("pins a message for both people, newest first, three at most; unpins", async () => {
    const ids: string[] = [];
    for (const body of ["one", "two", "three", "four"]) ids.push((await send("bola", { body }).expect(201)).body._id);
    let c = (await t.http.put(`/api/conversations/${convo}/messages/${ids[0]}/pin`).set(t.auth("ada")).send({ for: "7d" }).expect(200)).body;
    expect(c.pins).toEqual([expect.objectContaining({ messageId: ids[0], by: "ada", senderUid: "bola", body: "one", photo: false })]);
    for (const id of ids.slice(1)) c = (await t.http.put(`/api/conversations/${convo}/messages/${id}/pin`).set(t.auth("bola")).send({ for: "24h" }).expect(200)).body;
    // A fourth replaced the oldest.
    expect(c.pins.map((p: { body: string }) => p.body)).toEqual(["four", "three", "two"]);
    const seen = (await t.http.get(`/api/conversations/${convo}`).set(t.auth("ada")).expect(200)).body;
    expect(seen.pins).toHaveLength(3);
    c = (await t.http.delete(`/api/conversations/${convo}/messages/${ids[3]}/pin`).set(t.auth("ada")).expect(200)).body;
    expect(c.pins.map((p: { body: string }) => p.body)).toEqual(["three", "two"]);
    await t.http.put(`/api/conversations/${convo}/messages/${ids[1]}/pin`).set(t.auth("ada")).send({ for: "1y" }).expect(400);
    // Expired pins drop off by themselves.
    await t.model("Conversation").collection.updateOne({ _id: new Types.ObjectId(convo) }, { $set: { "pins.0.until": new Date(Date.now() - 1000) } });
    const later = (await t.http.get(`/api/conversations/${convo}`).set(t.auth("ada")).expect(200)).body;
    expect(later.pins.map((p: { body: string }) => p.body)).toEqual(["two"]);
  });
});
