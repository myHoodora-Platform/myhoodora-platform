import { AuditService } from "../src/audit/audit.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const LEKKI = { lng: 3.4746, lat: 6.4478 };
// About 4.5 km east of Lekki Phase 1: clear of it at 2,000 m + 1,500 m; Lekki Phase 1 reaches its centre past 4.5 km.
const LEKKI2 = { lng: 3.5146, lat: 6.44 };

/** Audit B18, B19, B21, B22 and B24: small ways a group or a staff action could end up half done. */
describe("Groups and staff actions finish what they start", () => {
  let t: TestApp;
  let lekki: string;
  let lekki2: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", LEKKI.lng, LEKKI.lat, 2000);
    lekki2 = await t.hood("Lekki Phase 2", LEKKI2.lng, LEKKI2.lat, 1500);
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, lekki);
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());
  afterEach(() => jest.restoreAllMocks());

  const audits = (filter: Record<string, unknown>) => t.model<{ action: string; target: { id: string; label: string } }>("AuditEvent").find(filter).lean();
  const newGroup = async (uid: string, patch: Record<string, unknown> = {}) =>
    (await t.http.post("/api/groups").set(t.auth(uid)).send({ name: "Road 12 Parents", description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood", ...patch }).expect(201)).body._id as string;
  /** The audit log can't be written: whatever was being done must not have happened either. */
  const auditFails = () => jest.spyOn(t.app.get(AuditService), "record").mockRejectedValue(new Error("audit log unavailable"));
  const quiet = () => jest.spyOn(console, "error").mockImplementation(() => undefined);

  describe("B18: a notification never fails on its own length after the action is done", () => {
    it("removing a member with the longest allowed names and reason removes them and tells them", async () => {
      const longName = "N".repeat(60);
      await t.member("longo", lekki, { displayName: longName });
      const groupId = await newGroup("longo", { name: "G".repeat(60) });
      await t.http.post(`/api/groups/${groupId}/join`).set(t.auth("bola")).send({}).expect(200);
      // An invitation's title is the inviter's name plus the group's: one character over the limit at their longest.
      await t.http.post(`/api/groups/${groupId}/invites`).set(t.auth("longo")).send({ uids: ["chidi"] }).expect((r) => expect(r.status).toBeLessThan(300));
      await t.http.delete(`/api/groups/${groupId}/members/bola`).set(t.auth("longo")).send({ reason: "R".repeat(300) }).expect((r) => expect(r.status).toBeLessThan(300));

      const notes = t.model<{ uid: string; title: string; body?: string }>("Notification");
      const invite = await notes.findOne({ uid: "chidi", title: /invited you/ }).lean();
      expect(invite!.title.length).toBeLessThanOrEqual(140);
      const removal = await notes.findOne({ uid: "bola", title: /removed from/ }).lean();
      expect(removal!.body!.length).toBeLessThanOrEqual(280);
      expect(await t.model("GroupMember").countDocuments({ groupId, uid: "bola" })).toBe(0);
    });
  });

  describe("B19: a group doesn't outlive its last member", () => {
    it("when the only member leaves, the group is archived and can't be found or joined", async () => {
      const groupId = await newGroup("ada", { name: "Lonely Hearts Club" });
      await t.http.delete(`/api/groups/${groupId}/membership`).set(t.auth("ada")).expect((r) => expect(r.status).toBeLessThan(300));

      const record = await t.model<{ archivedAt: Date | null; memberCount: number }>("Group").findById(groupId).lean();
      expect(record!.archivedAt).toBeInstanceOf(Date);
      expect(record!.memberCount).toBe(0);
      const listed = (await t.http.get("/api/groups").set(t.auth("bola")).expect(200)).body as { _id: string }[];
      expect(listed.map((g) => g._id)).not.toContain(groupId);
      await t.http.get(`/api/groups/${groupId}`).set(t.auth("bola")).expect(404);
      await t.http.post(`/api/groups/${groupId}/join`).set(t.auth("bola")).send({}).expect(404);
      // Archived, not destroyed: anything former members posted is still on record for staff.
      expect(await t.model("Group").countDocuments({ _id: groupId })).toBe(1);
    });

    it("a group with other members carries on when someone leaves, and its only admin still can't walk out on them", async () => {
      const groupId = await newGroup("ada", { name: "Sunday Football" });
      await t.http.post(`/api/groups/${groupId}/join`).set(t.auth("bola")).send({}).expect(200);
      await t.http.delete(`/api/groups/${groupId}/membership`).set(t.auth("ada")).expect(409);
      await t.http.delete(`/api/groups/${groupId}/membership`).set(t.auth("bola")).expect((r) => expect(r.status).toBeLessThan(300));
      expect((await t.model<{ archivedAt: Date | null }>("Group").findById(groupId).lean())!.archivedAt).toBeNull();
      await t.http.get(`/api/groups/${groupId}`).set(t.auth("chidi")).expect(200);
    });
  });

  describe("B21: a bulk action reports on every neighbour, and one failure doesn't stop the rest", () => {
    it("says which succeeded and which didn't, and why", async () => {
      for (const uid of ["u1", "u2", "u3"]) await t.user(uid);
      const res = await t.http.post("/api/admin/neighbours/bulk").set(t.auth("admin1")).send({ uids: ["u1", "nobody", "admin1", "u2", "u3"], action: "verify", hoodId: lekki, reason: "Checked at the estate office" }).expect(201);
      expect(res.body.updated).toBe(3);
      expect(res.body.results).toEqual([
        { uid: "u1", ok: true },
        { uid: "nobody", ok: false, message: "Neighbour not found." },
        { uid: "admin1", ok: false, message: "You can't take staff action on your own account." },
        { uid: "u2", ok: true },
        { uid: "u3", ok: true },
      ]);
      // The ones after the failures were not skipped.
      for (const uid of ["u1", "u2", "u3"]) expect((await t.users.findOne({ uid }).lean())?.verificationStatus).toBe("verified");
    });

    it("is still refused outright when the person may not take that action at all: that isn't about any one neighbour", async () => {
      await t.http.post("/api/admin/neighbours/bulk").set(t.auth("mod1")).send({ uids: ["ada", "bola"], action: "suspend", reason: "Scam" }).expect(403);
      await t.http.post("/api/admin/neighbours/bulk").set(t.auth("mod1")).send({ uids: ["ada"], action: "restrict", days: 14, reason: "Spam" }).expect(403);
      await t.http.post("/api/admin/neighbours/bulk").set(t.auth("ada")).send({ uids: ["bola"], action: "verify", hoodId: lekki, reason: "x2" }).expect(403);
      expect((await t.users.findOne({ uid: "ada" }).lean())?.accountStatus).toBe("active");
    });

    it("a rule about one neighbour (staff at or above your rank) fails that one only", async () => {
      await t.member("mod2", lekki, { role: "moderator" });
      const res = await t.http.post("/api/admin/neighbours/bulk").set(t.auth("mod1")).send({ uids: ["mod2", "dayo"], action: "restrict", days: 3, reason: "Spam" }).expect(201);
      expect(res.body).toEqual({
        updated: 1,
        results: [
          { uid: "mod2", ok: false, message: "You can't take action on staff at or above your role." },
          { uid: "dayo", ok: true },
        ],
      });
      await t.users.updateOne({ uid: "dayo" }, { $set: { accountStatus: "active", restrictedUntil: null } });
    });
  });

  describe("B22: Hood changes are checked and recorded however they are made", () => {
    it("a Hood can be grown into its neighbour but not over its centre, and can be shrunk", async () => {
      const grow = (radiusMeters: number) => t.http.patch(`/api/admin/hoods/${lekki}`).set(t.auth("admin1")).send({ radiusMeters, reason: "Estate extension" });
      // Lekki Phase 2's circle starts about 3 km from this centre, and its centre is about 4.5 km away.
      const res = await grow(5000).expect(409);
      expect(res.body.message).toMatch(/centre of Lekki Phase 2/);
      expect((await t.hoods.findById(lekki).lean())!.radiusMeters).toBe(2000);
      await grow(4000).expect(200);
      await grow(1800).expect(200);
      // Renaming or pausing involves no geometry, so needs no check.
      await t.http.patch(`/api/admin/hoods/${lekki}`).set(t.auth("admin1")).send({ description: "Phase 1 and the estates beside it" }).expect(200);
    });

    it("the older /neighborhoods write routes leave an audit record too", async () => {
      const created = await t.http.post("/api/neighborhoods").set(t.auth("admin1")).send({ name: "Ikoyi", city: "Lagos", center: { lat: 6.4541, lng: 3.4336 }, radiusMeters: 1000 }).expect(201);
      expect(await audits({ action: "hood_create", "target.id": created.body._id })).toEqual([expect.objectContaining({ target: expect.objectContaining({ label: "Ikoyi" }) })]);
      await t.http.delete(`/api/neighborhoods/${created.body._id}`).set(t.auth("admin1")).expect(204);
      expect(await audits({ action: "hood_archive", "target.id": created.body._id })).toHaveLength(1);
    });
  });

  describe("B24: a staff action and its audit record happen together or not at all", () => {
    it("removing a post", async () => {
      const post = await t.post("ada", { message: "Buy my miracle cure" });
      auditFails();
      quiet();
      await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("mod1")).send({ action: "remove", reason: "Scam" }).expect(500);
      jest.restoreAllMocks();
      // Not removed: there is no record of anyone removing it.
      await t.http.get(`/api/posts/${post._id}`).set(t.auth("bola")).expect(200);

      await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("mod1")).send({ action: "remove", reason: "Scam" }).expect(201);
      await t.http.get(`/api/posts/${post._id}`).set(t.auth("bola")).expect(404);
      expect(await audits({ action: "remove_content", "target.id": post._id })).toHaveLength(1);
    });

    it("ending, downgrading or removing an alert", async () => {
      const alert = await t.post("ada", { message: "Gunshots near the gate", category: "alert", alertCategory: "security", urgent: true });
      for (const action of ["downgrade", "end", "remove"] as const) {
        auditFails();
        quiet();
        await t.http.post(`/api/admin/alerts/${alert._id}/actions`).set(t.auth("mod1")).send({ action, reason: "False alarm" }).expect(500);
        jest.restoreAllMocks();
      }
      const untouched = (await t.http.get(`/api/posts/${alert._id}`).set(t.auth("bola")).expect(200)).body;
      expect(untouched).toMatchObject({ urgent: true, resolvedAt: null });

      await t.http.post(`/api/admin/alerts/${alert._id}/actions`).set(t.auth("mod1")).send({ action: "downgrade", reason: "Not urgent" }).expect(201);
      expect((await t.http.get(`/api/posts/${alert._id}`).set(t.auth("bola")).expect(200)).body.urgent).toBe(false);
      expect(await audits({ action: "alert_downgrade", "target.id": alert._id })).toHaveLength(1);
    });

    it("creating and changing a Hood", async () => {
      auditFails();
      quiet();
      await t.http.post("/api/admin/hoods").set(t.auth("admin1")).send({ name: "Surulere", city: "Lagos", center: { lat: 6.5, lng: 3.35 }, radiusMeters: 1500 }).expect(500);
      await t.http.patch(`/api/admin/hoods/${lekki2}`).set(t.auth("admin1")).send({ status: "paused", reason: "Flooding" }).expect(500);
      jest.restoreAllMocks();
      expect(await t.hoods.countDocuments({ name: "Surulere" })).toBe(0);
      expect((await t.hoods.findById(lekki2).lean())!.status).toBe("active");

      await t.http.post("/api/admin/hoods").set(t.auth("admin1")).send({ name: "Surulere", city: "Lagos", center: { lat: 6.5, lng: 3.35 }, radiusMeters: 1500 }).expect(201);
      expect(await t.hoods.countDocuments({ name: "Surulere" })).toBe(1);
    });

    it("appointing Hood Leads", async () => {
      auditFails();
      quiet();
      await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("admin1")).send({ uids: ["ada", "bola"] }).expect(500);
      jest.restoreAllMocks();
      expect(await t.model("HoodRole").countDocuments({ hoodId: lekki })).toBe(0);

      await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("admin1")).send({ uids: ["ada", "bola"] }).expect(200);
      expect(await t.model("HoodRole").countDocuments({ hoodId: lekki })).toBe(2);
      expect(await audits({ action: "lead_appoint" })).toHaveLength(2);
    });
  });
});
