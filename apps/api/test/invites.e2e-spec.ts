import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type Summary = { code: string; link: string; joined: number; verified: number; verifiedInMyHood: number; people: { name: string; hoodName?: string; verified: boolean }[]; invitedBy: { name: string } | null; askWhoInvited: boolean };

/** Invite codes and who brought whom (plan WP-E, contract §40), with a crowd. */
describe("Invite codes and referral paths", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  const CROWD = 120;
  const VIAS = ["link", "post", "badge", "group", "qr", "code"] as const;

  const me = async (uid: string) => (await t.http.get("/api/invites/me").set(t.auth(uid)).expect(200)).body as Summary;
  const claim = (uid: string, body: Record<string, unknown>) => t.http.post("/api/invites/claim").set(t.auth(uid)).send(body);
  let adaCode: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 1500);
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("ada", lekki, { displayName: "Adaeze Okafor" });
    await t.member("tunde", yaba, { displayName: "Tunde Bello" });
    await t.member("mod1", yaba, { role: "moderator" });
    await t.member("admin1", yaba, { role: "admin" });
    await t.user("oldtimer", { createdAt: new Date("2026-10-01T10:00:00Z") } as never);
    await t.users.updateOne({ uid: "oldtimer" }, { $set: { createdAt: new Date("2026-10-01T10:00:00Z") } }, { timestamps: false });
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ uid: `new${i}`, email: `new${i}@test.dev`, displayName: `Newcomer ${i} Eze`, ageConfirmedAt: new Date() })),
    );
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("gives every neighbour a short personal code and link, made once", async () => {
    const first = await me("ada");
    expect(first.code).toMatch(/^ADA[2-9A-HJKMNP-Z]{2}$/);
    expect(first.link).toMatch(new RegExp(`/i/${first.code}$`));
    expect((await me("ada")).code).toBe(first.code);
    adaCode = first.code;
    // Many at once never share a code.
    const codes: string[] = [];
    for (let i = 0; i < 30; i += 5) codes.push(...(await Promise.all([0, 1, 2, 3, 4].map((j) => me(`new${i + j}`).then((s) => s.code)))));
    expect(new Set(codes).size).toBe(30);
  });

  it("the invite page shows the inviter's first name and Hood only", async () => {
    const page = (await t.http.get(`/api/public/invites/${adaCode.toLowerCase()}`).expect(200)).body;
    expect(page).toEqual({ code: adaCode, inviter: { firstName: "Adaeze" }, hood: { name: "Lekki Phase 1", city: "Lagos" } });
    expect(JSON.stringify(page)).not.toMatch(/Okafor|ada@/);
    await t.http.get("/api/public/invites/ZZZZZ").expect(404);
    await t.http.get("/api/public/invites/<b>").expect(404);
  });

  it("a crowd joins with Ada's code by every path; only the verified count", async () => {
    for (let i = 0; i < CROWD; i++) {
      const res = await claim(`new${i}`, { code: i % 3 ? adaCode : ` ${adaCode.toLowerCase().slice(0, 3)}-${adaCode.slice(3)} `, via: VIAS[i % VIAS.length] });
      expect([i, res.status, res.body]).toEqual([i, 201, { invitedBy: { name: "Adaeze" } }]);
      if (i % 5 === 4) t.resetThrottle();
    }
    // Half verify: 40 in Lekki, 20 in Yaba. The rest are still joining.
    for (let i = 0; i < 60; i++) await t.users.updateOne({ uid: `new${i}` }, { $set: { verificationStatus: "verified", neighborhoodId: i < 40 ? lekki : yaba } });
    const s = await me("ada");
    expect(s).toMatchObject({ joined: CROWD, verified: 60, verifiedInMyHood: 40 });
    expect(s.people).toHaveLength(20);
    expect(s.people.every((p) => /^Newcomer E\.$/.test(p.name))).toBe(true);
    expect((await me("new5")).invitedBy).toEqual({ name: "Adaeze" });
  });

  it("the first code wins; no self-invites, loops, unknown codes, or late claims", async () => {
    await claim("new1", { code: adaCode, via: "link" }).expect(201); // same again: fine
    const tunde = (await me("tunde")).code;
    expect((await claim("new1", { code: tunde, via: "code" }).expect(409)).body.message).toMatch(/already told us/);
    expect((await claim("ada", { code: adaCode, via: "code" }).expect(400)).body.message).toMatch(/your own/);
    await claim("new200", { code: "NOPE9", via: "code" }).expect(404);
    await t.user("late");
    await claim("late", { code: "!!", via: "code" }).expect(400);
    await claim("oldtimer", { code: adaCode, via: "code" }).expect(400);
    // new1 was invited by Ada, so Ada can't name new1 as her inviter.
    const new1 = (await me("new1")).code;
    await t.users.updateOne({ uid: "ada" }, { $set: { createdAt: new Date() } });
    expect((await claim("ada", { code: new1, via: "code" }).expect(400)).body.message).toMatch(/You invited them/);
  });

  it("asks 'Who invited you?' once, and lets them pick a neighbour from their Hood", async () => {
    await t.member("kemi", lekki, { displayName: "Kemi Ade" });
    expect((await me("kemi")).askWhoInvited).toBe(true);
    await claim("kemi", { uid: "tunde", via: "asked" }).expect(404); // not in her Hood
    await claim("kemi", { uid: "ada", via: "asked" }).expect(201);
    expect(await me("kemi")).toMatchObject({ askWhoInvited: false, invitedBy: { name: "Adaeze" } });
    await t.member("bayo", lekki);
    await t.http.post("/api/invites/me/dismiss").set(t.auth("bayo")).expect(204);
    expect((await me("bayo")).askWhoInvited).toBe(false);
    expect((await me("oldtimer")).askWhoInvited).toBe(false);
  });

  it("staff see the leaderboard and a CSV; only admins change who gets credit, audited", async () => {
    const board = (await t.http.get("/api/admin/invites").set(t.auth("mod1")).expect(200)).body;
    expect(board.people[0]).toMatchObject({ uid: "ada", displayName: "Adaeze Okafor", code: adaCode, hood: { name: "Lekki Phase 1" }, verified: 61, joined: CROWD + 1 });
    expect(board.hoods[0]).toMatchObject({ id: lekki, verified: 61 });
    expect(board.totals).toMatchObject({ verified: 61 });
    const inYaba = (await t.http.get(`/api/admin/invites?hoodId=${yaba}`).set(t.auth("mod1")).expect(200)).body;
    expect(inYaba.people.some((p: { uid: string }) => p.uid === "ada")).toBe(false);

    await t.users.updateOne({ uid: "ada" }, { $set: { displayName: "=HYPERLINK(\"x\")" } });
    const csv = await t.http.get("/api/admin/invites?format=csv").set(t.auth("mod1")).expect(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.text.split("\n")[0]).toBe('"Name","Invite code","Hood","Joined","Verified","Flagged"');
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")","${adaCode}"`);

    await t.http.put("/api/admin/invites/new0").set(t.auth("mod1")).send({ code: null, reason: "Same device as Ada" }).expect(403);
    await t.http.put("/api/admin/invites/new0").set(t.auth("admin1")).send({ code: null, reason: "Same device as Ada" }).expect(200);
    const tunde = (await me("tunde")).code;
    expect((await t.http.put("/api/admin/invites/new1").set(t.auth("admin1")).send({ code: tunde, reason: "Tunde brought them" }).expect(200)).body).toMatchObject({ invitedBy: { code: tunde } });
    expect(await me("ada")).toMatchObject({ verified: 59 });
    const audit = await t.model("AuditEvent").find({ action: { $in: ["invite_void", "invite_reassign"] } }).lean();
    expect(audit).toHaveLength(2);
  });

  it("puts newcomers invited by a verified neighbour first in the verification queue", async () => {
    for (let i = 0; i < 10; i++) await t.user(`wait${i}`, { verificationStatus: "pending_review", displayName: `Waiting ${i}` });
    await claim("wait7", { code: adaCode, via: "qr" }).expect(201);
    const q = (await t.http.get("/api/admin/verification?status=pending_review").set(t.auth("mod1")).expect(200)).body;
    expect(q.items[0]).toMatchObject({ uid: "wait7", invitedBy: { uid: "ada", verified: true, hoodName: "Lekki Phase 1" } });
    expect(q.items.slice(1).every((i: { invitedBy?: unknown }) => !i.invitedBy)).toBe(true);
  });

  it("flags invites from the inviter's own phone or one shared phone; staff review them", async () => {
    await t.http.get("/api/invites/me?device=ada-phone-0001").set(t.auth("ada")).expect(200);
    await t.user("sock1");
    await claim("sock1", { code: adaCode, via: "code", device: "ada-phone-0001" }).expect(201);
    for (const uid of ["twin1", "twin2"]) {
      await t.user(uid);
      await claim(uid, { code: adaCode, via: "link", device: "shared-phone-77" }).expect(201);
    }
    await claim("late", { code: adaCode, via: "code", device: "bad id!" }).expect(400);

    const flags = (await t.http.get("/api/admin/invites/flags").set(t.auth("mod1")).expect(200)).body as { inviter: { uid: string }; reasons: string[]; invitees: { uid: string; reasons: string[] }[] }[];
    const ada = flags.find((g) => g.inviter.uid === "ada")!;
    expect(ada.reasons).toEqual(expect.arrayContaining(["same_device_as_inviter", "shared_device"]));
    expect(ada.invitees.find((i) => i.uid === "sock1")!.reasons).toContain("same_device_as_inviter");
    expect(ada.invitees.find((i) => i.uid === "twin2")!.reasons).toContain("shared_device");
    // Nothing raw is ever stored or shown.
    const stored = await t.users.findOne({ uid: "sock1" }).lean();
    expect(JSON.stringify(stored)).not.toMatch(/ada-phone-0001|127\.0\.0\.1|::1/);
    expect(JSON.stringify(flags)).not.toMatch(/ada-phone|shared-phone/);

    expect((await t.http.get("/api/admin/invites/people/sock1").set(t.auth("mod1")).expect(200)).body).toMatchObject({ invitedBy: { uid: "ada", code: adaCode, reviewed: false }, flags: expect.arrayContaining(["same_device_as_inviter"]) });
    expect((await t.http.get("/api/admin/invites").set(t.auth("mod1")).expect(200)).body.people[0].flagged).toBeGreaterThanOrEqual(3);

    await t.http.post("/api/admin/invites/twin1/reviewed").set(t.auth("mod1")).send({ reason: "Twins, one phone" }).expect(403);
    await t.http.post("/api/admin/invites/twin1/reviewed").set(t.auth("admin1")).send({ reason: "Twins, one phone" }).expect(204);
    const after = (await t.http.get("/api/admin/invites/flags").set(t.auth("mod1")).expect(200)).body as typeof flags;
    expect(after.find((g) => g.inviter.uid === "ada")!.invitees.some((i) => i.uid === "twin1")).toBe(false);
    expect((await t.http.get("/api/admin/invites/people/twin1").set(t.auth("mod1")).expect(200)).body.invitedBy.reviewed).toBe(true);
  });
});
