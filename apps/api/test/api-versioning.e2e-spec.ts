import { Controller, Get, Version } from "@nestjs/common";
import { Public } from "../src/shared/auth/public.decorator";
import { DeprecatedRoute } from "../src/shared/http/versioning";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** A v1 route with a v2 successor, as a breaking change would be made (docs/api-versioning.md). */
@Controller("versioning-demo")
class DemoController {
  @Public()
  @Get()
  @DeprecatedRoute({ since: "2026-11-03", sunset: "2027-05-01", successor: "/api/v2/versioning-demo" })
  v1() {
    return { shape: "old" };
  }

  @Public()
  @Get()
  @Version("2")
  v2() {
    return { shape: "new" };
  }
}

describe("API versions", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp((b) => b, [DemoController]);
    lekki = await t.hood();
    await t.member("ada", lekki);
  });
  afterAll(() => t.close());

  it("every route answers at /api/v1, and the unversioned /api stays v1 for builds already out there", async () => {
    const versioned = await t.http.get("/api/v1/users/me").set(t.auth("ada")).expect(200);
    const plain = await t.http.get("/api/users/me").set(t.auth("ada")).expect(200);
    expect(versioned.body.uid).toBe("ada");
    expect(plain.body).toEqual(versioned.body);
    expect(versioned.headers["api-version"]).toBe("1");
    expect(plain.headers["api-version"]).toBe("1");
  });

  it("a version that doesn't exist is a 404, not v1", async () => {
    await t.http.get("/api/v9/users/me").set(t.auth("ada")).expect(404);
  });

  it("says which versions are served", async () => {
    expect((await t.http.get("/api/version").expect(200)).body).toEqual({ current: "1", supported: ["1"], deprecated: [] });
  });

  it("a breaking change lives beside v1 as v2, and v1 announces its sunset", async () => {
    expect((await t.http.get("/api/v2/versioning-demo").expect(200)).body).toEqual({ shape: "new" });
    const old = await t.http.get("/api/v1/versioning-demo").expect(200);
    expect(old.body).toEqual({ shape: "old" });
    expect(old.headers.deprecation).toBe(`@${Date.UTC(2026, 10, 3) / 1000}`);
    expect(old.headers.sunset).toBe("Sat, 01 May 2027 00:00:00 GMT");
    expect(old.headers.link).toBe('</api/v2/versioning-demo>; rel="successor-version"');
    // The unversioned path is v1, deprecation and all.
    expect((await t.http.get("/api/versioning-demo").expect(200)).headers.sunset).toBe("Sat, 01 May 2027 00:00:00 GMT");
  });
});
