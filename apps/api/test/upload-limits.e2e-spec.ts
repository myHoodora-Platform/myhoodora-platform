import { readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { STORAGE_PROVIDER } from "../src/storage/providers/storage-provider";
import type { StorageProvider } from "../src/storage/providers/storage-provider";
import { MAX_BYTES, MAX_UPLOAD_BYTES } from "../src/storage/storage.service";
import { UPLOAD_TMP_DIR } from "../src/storage/temp-files";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** A real photo from the web app, sent from disk the way a browser sends it. */
const REAL_PHOTO = join(__dirname, "../../web/public/images/trust-hands.webp");
/** A JPEG header followed by padding: enough for the API to read the type. */
const jpegOf = (bytes: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4)]);
const tempFiles = () => readdirSync(UPLOAD_TMP_DIR).length;

/**
 * The upload form and request bodies are parsed by multer and body-parser before any of our code
 * runs. These pin how they behave at the edges, so a dependency update can't quietly change it.
 */
describe("Upload and request-body limits (multer, body-parser)", () => {
  let t: TestApp;
  let stored = 0;
  const storage: StorageProvider = {
    name: "fake",
    upload: async (f) => {
      stored++;
      return { providerId: `${f.folder}/f${stored}`, url: `https://cdn.test/${f.folder}/f${stored}.webp`, resourceType: f.resourceType, format: "webp", bytes: 226_524, width: 1200, height: 800 };
    },
    delete: async () => undefined,
    url: (providerId) => `https://cdn.test/${providerId}`,
  };
  const upload = () => t.http.post("/api/media").set(t.auth("ada")).field("purpose", "post");

  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(STORAGE_PROVIDER).useValue(storage));
    await t.member("ada", await t.hood("Lekki Phase 1"));
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("stores a real photo and leaves no temp file behind", async () => {
    const before = { stored, temp: tempFiles() };
    const res = await upload().attach("file", REAL_PHOTO).expect(201);
    expect(res.body).toMatchObject({ resourceType: "image", format: "webp" });
    expect(stored).toBe(before.stored + 1);
    expect(tempFiles()).toBe(before.temp);
  });

  it("refuses a photo over the photo limit with 413, and removes the temp file", async () => {
    const before = { stored, temp: tempFiles() };
    const res = await upload().attach("file", jpegOf(MAX_BYTES.image + 1), "big.jpg").expect(413);
    expect(res.body.message).toBe("Photos must be under 10 MB.");
    expect(stored).toBe(before.stored);
    expect(tempFiles()).toBe(before.temp);
  });

  it("stops a file over the parser's cap while it streams in, with 413", async () => {
    const before = { stored, temp: tempFiles() };
    const res = await upload().attach("file", jpegOf(MAX_UPLOAD_BYTES + 1), "huge.jpg").expect(413);
    expect(res.body).toEqual({ statusCode: 413, message: "File too large" });
    expect(stored).toBe(before.stored);
    expect(tempFiles()).toBe(before.temp);
  });

  it("answers a malformed form with 400, not 500", async () => {
    // A file under the wrong field name.
    await t.http.post("/api/media").set(t.auth("ada")).field("purpose", "post").attach("photo", REAL_PHOTO).expect(400);
    // Two files where one is allowed.
    await upload().attach("file", REAL_PHOTO).attach("file", REAL_PHOTO).expect(400);
  });

  it("turns away crafted field names before they reach validation, and keeps serving", async () => {
    // Without a limit, each of these costs seconds of CPU (or a stack overflow) in the validation pipe.
    const started = Date.now();
    const deep = await upload().field("a" + "[a]".repeat(5_000), "x").attach("file", REAL_PHOTO).expect(400);
    expect(deep.body.message).toBe("Field name nesting too deep");
    const index = await upload().field("list[999999999]", "x").attach("file", REAL_PHOTO).expect(400);
    expect(index.body.message).toBe("Field name nesting too deep");
    expect(Date.now() - started).toBeLessThan(5_000);
    await upload().attach("file", REAL_PHOTO).expect(201);
  });

  it("refuses a compressed body with trailing bytes with 400, and keeps serving", async () => {
    const body = Buffer.concat([gzipSync(JSON.stringify({ message: "hello" })), Buffer.from("trailing bytes")]);
    await t.http.post("/api/posts").set(t.auth("ada")).set("Content-Type", "application/json").set("Content-Encoding", "gzip").send(body).expect(400);
    await upload().attach("file", REAL_PHOTO).expect(201);
  });

  it("refuses a JSON body over the parser's limit with 413", async () => {
    const res = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "x".repeat(200_000) }).expect(413);
    expect(res.body).toEqual({ statusCode: 413, message: "request entity too large" });
  });
});
