import { STORAGE_PROVIDER, type StorageProvider } from "../src/storage/providers/storage-provider";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64)]);
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>");

/**
 * Support conversations take photos and PDFs both ways (2026-10-28): the team may ask for a document,
 * and send one back. Only files their sender uploaded for support; PDFs nowhere else.
 */
describe("Support attachments", () => {
  let t: TestApp;
  let n = 0;
  const storage: StorageProvider = {
    name: "fake",
    upload: async (f) => {
      const providerId = `${f.folder}/f${n++}`;
      const ext = f.resourceType === "document" ? "pdf" : "jpg";
      return { providerId, url: `https://cdn.test/${providerId}.${ext}`, resourceType: f.resourceType, format: ext, bytes: 2048 };
    },
    delete: async () => undefined,
    url: (providerId) => `https://cdn.test/${providerId}`,
  };
  const upload = (uid: string, purpose: string, file: Buffer, name: string) => t.http.post("/api/media").set(t.auth(uid)).field("purpose", purpose).attach("file", file, name);

  let thread: string;
  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(STORAGE_PROVIDER).useValue(storage));
    const lekki = await t.hood("Lekki Phase 1");
    await t.member("ada", lekki);
    await t.member("bola", lekki);
    await t.member("mod", lekki, { role: "moderator" });
    const req = await t.http.post("/api/support").set(t.auth("ada")).send({ topic: "verification", message: "My address check keeps failing although I live on Road 12." }).expect(201);
    thread = req.body.id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("takes a PDF for support, judged by its bytes, and nowhere else", async () => {
    const doc = await upload("ada", "support", PDF, "bill.pdf").expect(201);
    expect(doc.body.resourceType).toBe("document");
    await upload("ada", "post", PDF, "bill.pdf").expect(400);
    // A web page renamed to .pdf is still a web page.
    await upload("ada", "support", HTML, "bill.pdf").expect(400);
  });

  it("the neighbour sends a photo and a document, with or without words", async () => {
    const photo = (await upload("ada", "support", JPEG, "id.jpg").expect(201)).body.url;
    const bill = (await upload("ada", "support", PDF, "bill.pdf").expect(201)).body.url;
    const res = await t.http
      .post(`/api/support/threads/${thread}/messages`)
      .set(t.auth("ada"))
      .send({ attachments: [{ url: photo }, { url: bill, name: "Utility  bill\n.pdf" }] })
      .expect(200);
    const last = res.body.messages.at(-1);
    expect(last).toMatchObject({ from: "user", body: "", attachments: [{ url: photo, kind: "image" }, { url: bill, kind: "document", name: "Utility bill.pdf", bytes: 2048 }] });
    const list = await t.http.get("/api/support/threads").set(t.auth("ada")).expect(200);
    expect(list.body[0].lastMessage.body).toBe("📎 2 files");
  });

  it("refuses someone else's file, a file for something else, and an empty message", async () => {
    const bolas = (await upload("bola", "support", JPEG, "x.jpg").expect(201)).body.url;
    const forAPost = (await upload("ada", "post", JPEG, "x.jpg").expect(201)).body.url;
    for (const url of [bolas, forAPost, "https://evil.example/x.pdf"]) {
      await t.http.post(`/api/support/threads/${thread}/messages`).set(t.auth("ada")).send({ attachments: [{ url }] }).expect(400);
    }
    await t.http.post(`/api/support/threads/${thread}/messages`).set(t.auth("ada")).send({ body: "  " }).expect(400);
  });

  it("the team replies with a document, and the neighbour sees it", async () => {
    const form = (await upload("mod", "support", PDF, "form.pdf").expect(201)).body.url;
    await t.http.post(`/api/admin/inbox/${thread}/reply`).set(t.auth("mod")).send({ body: "Please fill this in.", attachments: [{ url: form, name: "Address form.pdf" }] }).expect(200);
    const mine = await t.http.get(`/api/support/threads/${thread}`).set(t.auth("ada")).expect(200);
    expect(mine.body.messages.at(-1)).toMatchObject({ from: "staff", body: "Please fill this in.", attachments: [{ url: form, kind: "document", name: "Address form.pdf" }] });
    const inbox = await t.http.get(`/api/admin/inbox/${thread}`).set(t.auth("mod")).expect(200);
    expect(inbox.body.messages.at(-1).attachments[0].name).toBe("Address form.pdf");
  });
});
