import { Types } from "mongoose";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Audit B10: messages and comments were read oldest-first with a cap of 500 and no way past it,
 * so the 501st and everything after it was stored and never shown.
 */
describe("Long threads: the newest page first, earlier pages on request", () => {
  let t: TestApp;
  let lekki: string;
  let conversationId: string;
  let postId: string;
  const TOTAL = 501;
  /** One a second, ending a minute ago: `n` is 1 for the oldest, TOTAL for the newest. */
  const sentAt = (n: number) => new Date(Date.now() - 60_000 - (TOTAL - n) * 1000);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    for (const uid of ["ada", "bola", "chidi"]) await t.member(uid, lekki);
    // In neither the conversation nor the Hood.
    await t.member("tunde", await t.hood("Yaba", 3.3711, 6.5095, 1500));

    conversationId = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "bola" }).expect(201)).body._id;
    await t.model("Message").insertMany(
      Array.from({ length: TOTAL }, (_, i) => ({ conversationId, senderUid: i % 2 ? "ada" : "bola", body: `message ${i + 1}`, createdAt: sentAt(i + 1) })),
    );

    postId = (await t.post("ada", { message: "Who else has no water this morning?" }))._id;
    await t.model("Comment").insertMany(Array.from({ length: TOTAL }, (_, i) => ({ postId, authorUid: i % 2 ? "ada" : "bola", content: `comment ${i + 1}`, createdAt: sentAt(i + 1) })));
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  type Item = { _id: string; body?: string; content?: string; createdAt: string };
  const text = (i: Item) => i.body ?? i.content;

  describe.each([
    { what: "messages", noun: "message", path: () => `/api/conversations/${conversationId}/messages` },
    { what: "comments", noun: "comment", path: () => `/api/posts/${postId}/comments` },
  ])("$what", ({ noun, path }) => {
    const page = async (query = "", as = "ada") => (await t.http.get(`${path()}${query}`).set(t.auth(as)).expect(200)).body as Item[];

    it("the newest one is there, however long the thread has grown", async () => {
      const items = await page();
      expect(items).toHaveLength(500);
      expect(text(items.at(-1)!)).toBe(`${noun} ${TOTAL}`);
      // Still oldest first within the page, as clients expect.
      expect(text(items[0]!)).toBe(`${noun} 2`);
      expect(items.map((i) => i.createdAt)).toEqual([...items.map((i) => i.createdAt)].sort());
    });

    it("`before` reaches everything earlier, down to the first, with no gaps or repeats", async () => {
      const newest = await page();
      const earlier = await page(`?before=${newest[0]!._id}`);
      expect(earlier.map(text)).toEqual([`${noun} 1`]);
      expect(await page(`?before=${earlier[0]!._id}`)).toEqual([]);
    });

    it("`limit` asks for a smaller page, and pages walk back through the thread in order", async () => {
      const seen: string[] = [];
      let before = "";
      for (let i = 0; i < 4; i++) {
        const items = await page(`?limit=3${before && `&before=${before}`}`);
        expect(items).toHaveLength(3);
        seen.unshift(...items.map((x) => text(x)!));
        before = items[0]!._id;
      }
      expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => `${noun} ${TOTAL - 11 + i}`));
    });

    it("refuses a cursor or limit that isn't one, and a cursor from somewhere else finds nothing", async () => {
      await t.http.get(`${path()}?before=not-an-id`).set(t.auth("ada")).expect(400);
      await t.http.get(`${path()}?limit=0`).set(t.auth("ada")).expect(400);
      await t.http.get(`${path()}?limit=501`).set(t.auth("ada")).expect(400);
      expect(await page(`?before=${new Types.ObjectId().toString()}`)).toEqual([]);
    });

    it("someone who can't see the thread still can't page through it", async () => {
      await t.http.get(`${path()}?limit=3`).set(t.auth("tunde")).expect(404);
    });
  });

  it("opening the newest messages marks the conversation read; looking back through earlier ones doesn't", async () => {
    await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("bola")).send({ body: "Are you there?" }).expect(201);
    const unread = async () => (await t.http.get("/api/conversations/unread-count").set(t.auth("ada")).expect(200)).body.count as number;
    expect(await unread()).toBe(1);

    // A neighbour who isn't in the conversation gets nothing, and reads nothing.
    await t.http.get(`/api/conversations/${conversationId}/messages?limit=5`).set(t.auth("chidi")).expect(404);
    const first = (await t.http.get(`/api/conversations/${conversationId}/messages?limit=5`).set(t.auth("bola")).expect(200)).body as Item[];
    // bola reading his own thread doesn't read it for ada.
    expect(await unread()).toBe(1);
    await t.http.get(`/api/conversations/${conversationId}/messages?limit=5&before=${first[0]!._id}`).set(t.auth("ada")).expect(200);
    expect(await unread()).toBe(1);
    await t.http.get(`/api/conversations/${conversationId}/messages?limit=5`).set(t.auth("ada")).expect(200);
    expect(await unread()).toBe(0);
  });
});
