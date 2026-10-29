import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface View { _id: string; content: string; parentId?: string; replyToUid?: string; likeCount: number; replyCount: number; liked: boolean; deleted?: boolean }

describe("Comment threads: replies, likes, sorting, safe resends", () => {
  let t: TestApp;
  let hood: string;
  let postId: string;

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, hood);
    postId = (await t.post("ada", { message: "Who fixes inverters?" }))._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const comment = (uid: string, body: Record<string, unknown>) => t.http.post(`/api/posts/${postId}/comments`).set(t.auth(uid)).send(body);
  const thread = async (uid: string, query: string) => (await t.http.get(`/api/posts/${postId}/comments?${query}`).set(t.auth(uid)).expect(200)).body as View[];
  const notes = async (uid: string) => (await t.http.get("/api/notifications").set(t.auth(uid)).expect(200)).body as { title: string }[];

  let first: string;
  let second: string;

  it("replies sit under the top-level comment, one level deep, and count there", async () => {
    first = (await comment("bola", { content: "Try Musa on Road 4" }).expect(201)).body._id;
    second = (await comment("chidi", { content: "Emeka is good too" }).expect(201)).body._id;
    const reply = (await comment("dayo", { content: "Musa fixed mine", parentId: first }).expect(201)).body as View;
    expect(reply).toMatchObject({ parentId: first, replyToUid: "bola" });

    // Replying to a reply joins the same thread and names whom it answers.
    const deeper = (await comment("ada", { content: "Thanks Dayo", parentId: reply._id }).expect(201)).body as View;
    expect(deeper).toMatchObject({ parentId: first, replyToUid: "dayo" });

    const roots = await thread("ada", "thread=root&sort=newest");
    expect(roots.map((c) => c._id)).toEqual([second, first]);
    expect(roots.find((c) => c._id === first)?.replyCount).toBe(2);
    expect((await thread("ada", `thread=${first}`)).map((c) => c.content)).toEqual(["Musa fixed mine", "Thanks Dayo"]);

    // The post counts every comment and reply.
    expect((await t.http.get(`/api/posts/${postId}`).set(t.auth("ada")).expect(200)).body.commentCount).toBe(4);
  });

  it("tells the person answered, and the post's author", async () => {
    expect((await notes("bola")).map((n) => n.title)).toContain("dayo replied to your comment");
    expect((await notes("dayo")).map((n) => n.title)).toContain("ada replied to your comment");
    expect((await notes("ada")).map((n) => n.title)).toContain("dayo replied to a comment on your post");
  });

  it("older apps still get every comment in one flat list, oldest first", async () => {
    const flat = await thread("ada", "");
    expect(flat.map((c) => c.content)).toEqual(["Try Musa on Road 4", "Emeka is good too", "Musa fixed mine", "Thanks Dayo"]);
  });

  it("likes are one per neighbour, undoable, and say whether you like it", async () => {
    const like = (uid: string) => t.http.put(`/api/comments/${second}/like`).set(t.auth(uid)).expect(200);
    expect((await like("ada")).body).toEqual({ likeCount: 1, liked: true });
    expect((await like("ada")).body).toEqual({ likeCount: 1, liked: true });
    expect((await like("dayo")).body).toEqual({ likeCount: 2, liked: true });
    expect((await t.http.delete(`/api/comments/${second}/like`).set(t.auth("dayo")).expect(200)).body).toEqual({ likeCount: 1, liked: false });
    expect((await t.http.delete(`/api/comments/${second}/like`).set(t.auth("dayo")).expect(200)).body).toEqual({ likeCount: 1, liked: false });

    const roots = await thread("ada", "thread=root&sort=newest");
    expect(roots.find((c) => c._id === second)).toMatchObject({ likeCount: 1, liked: true });
    expect((await thread("bola", "thread=root&sort=newest")).find((c) => c._id === second)?.liked).toBe(false);
    expect((await notes("chidi")).map((n) => n.title)).toContain("dayo and ada liked your comment");
  });

  it("'most relevant' puts conversation and likes first; oldest and paging work", async () => {
    // first: 2 replies (6), second: 1 like (2), a new one: nothing.
    const third = (await comment("dayo", { content: "Anyone tried the shop by the market?" }).expect(201)).body._id;
    expect((await thread("ada", "thread=root")).map((c) => c._id)).toEqual([first, second, third]);
    expect((await thread("ada", "thread=root&sort=oldest")).map((c) => c._id)).toEqual([first, second, third]);
    expect((await thread("ada", "thread=root&sort=newest&limit=1&offset=1")).map((c) => c._id)).toEqual([second]);
  });

  it("sending the same comment twice (a retry, a double tap) makes one", async () => {
    const send = () => comment("chidi", { content: "Only once please", clientId: "draft-123456789" });
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status].sort()).toEqual([201, 201]);
    expect(a.body._id).toBe(b.body._id);
    expect((await send().expect(201)).body._id).toBe(a.body._id);
    expect((await thread("ada", "")).filter((c) => c.content === "Only once please")).toHaveLength(1);
  });

  it("a deleted comment with replies stays as a placeholder, without its words", async () => {
    await t.http.delete(`/api/comments/${first}`).set(t.auth("bola")).expect(204);
    const placeholder = (await thread("ada", "thread=root&sort=oldest")).find((c) => c._id === first);
    expect(placeholder).toMatchObject({ deleted: true, content: "", replyCount: 2 });
    expect((await thread("ada", "")).some((c) => c._id === first)).toBe(false);
  });

  it("refuses a reply to a comment that isn't there, and checks the inputs", async () => {
    await comment("chidi", { content: "Hello?", parentId: "0123456789abcdef01234567" }).expect(404);
    await comment("chidi", { content: "Hi", clientId: "no" }).expect(400);
    await t.http.get(`/api/posts/${postId}/comments?thread=nope`).set(t.auth("ada")).expect(400);
    await t.http.get(`/api/posts/${postId}/comments?thread=root&sort=loud`).set(t.auth("ada")).expect(400);
    await t.http.put("/api/comments/0123456789abcdef01234567/like").set(t.auth("ada")).expect(404);
  });
});
