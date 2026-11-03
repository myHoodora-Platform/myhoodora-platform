import { createTestApp, type TestApp } from "./helpers/app";
import { groupedTitle } from "../src/notifications/notifications.service";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface Row { _id: string; title: string; href: string; read: boolean; actors?: { uid: string; displayName: string }[]; actorCount?: number; preview?: { image: string } }

describe("Notifications list: faces, counts and thumbnails", () => {
  let t: TestApp;
  let hood: string;

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, hood);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const list = async (uid: string) => (await t.http.get("/api/notifications").set(t.auth(uid)).expect(200)).body as Row[];
  const react = (uid: string, postId: string) => t.http.put(`/api/posts/${postId}/reaction`).set(t.auth(uid)).send({ type: "like" });
  const rowFor = async (postId: string) => (await list("ada")).filter((n) => n.href === `/p/${postId}`);

  it("collapses reactions into one row with the latest faces first and the post's photo", async () => {
    const post = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "Sunset", mediaUrls: ["https://images.unsplash.com/photo-1.jpg"] }).expect(201);
    const id = post.body._id as string;
    for (const uid of ["bola", "chidi", "dayo"]) await react(uid, id).expect((r) => expect(r.status).toBeLessThan(300));

    const rows = await rowFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].actors?.map((a) => a.uid)).toEqual(["dayo", "chidi", "bola"]);
    expect(rows[0].actorCount).toBe(3);
    expect(rows[0].title).toBe("dayo and 2 others reacted to your post");
    expect(rows[0].preview).toEqual({ image: "https://images.unsplash.com/photo-1.jpg" });

    // Taking a reaction back and reacting again moves them to the front without counting them twice.
    await t.http.delete(`/api/posts/${id}/reaction`).set(t.auth("bola"));
    await react("bola", id);
    const again = (await rowFor(id))[0];
    expect(again.actors?.map((a) => a.uid)).toEqual(["bola", "dayo", "chidi"]);
    expect(again.actorCount).toBe(3);

    // Once read, the next reaction starts a fresh row.
    await t.http.patch(`/api/notifications/${again._id}`).set(t.auth("ada")).send({ read: true }).expect(200);
    await t.http.delete(`/api/posts/${id}/reaction`).set(t.auth("chidi"));
    await react("chidi", id);
    const fresh = (await rowFor(id)).find((n) => !n.read);
    expect(fresh?.actorCount).toBeUndefined();
    expect(fresh?.actors?.map((a) => a.uid)).toEqual(["chidi"]);
    expect(fresh?.title).toBe("chidi reacted to your post");
  });

  it("gives no thumbnail for a video-only post", async () => {
    const clip = "https://res.cloudinary.com/demo/video/upload/v1/myhoodora/test/post/clip.mp4";
    const post = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "A clip", mediaUrls: [clip] }).expect(201);
    await react("bola", post.body._id);
    const [row] = await rowFor(post.body._id);
    expect(row.preview).toBeUndefined();
    expect(row.actors?.[0]).toMatchObject({ uid: "bola", displayName: "bola" });
  });

  it("names both people when there are two, and leaves other wordings alone", () => {
    const a = { uid: "a", displayName: "Tunde" };
    const b = { uid: "b", displayName: "Ada" };
    expect(groupedTitle("Tunde reacted to your post", [a, b], 2)).toBe("Tunde and Ada reacted to your post");
    expect(groupedTitle("Tunde reacted to your post", [a], 1)).toBe("Tunde reacted to your post");
    expect(groupedTitle("New reaction on your post", [a, b], 5)).toBe("New reaction on your post");
  });
});
