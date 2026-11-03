import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const application = (patch: Record<string, unknown> = {}) => ({
  businessName: "Mama Nkechi Kitchen",
  category: "food",
  description: "Home-cooked Nigerian meals delivered around Lekki.",
  areasServed: ["Lekki Phase 1"],
  contactName: "Nkechi Obi",
  phone: "+2348031234567",
  email: "nkechi@kitchen.test",
  cacNumber: "BN1234567",
  wantsAdsUpdates: true,
  ...patch,
});

describe("Inbound forms, support inbox and Business Pages", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    await t.member("ada", lekki);
    await t.member("mod", lekki, { role: "moderator" });
    await t.member("admin1", lekki, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  describe("public forms (no account)", () => {
    it("contact: received, acknowledged by email, safety prioritised", async () => {
      const res = await t.http.post("/api/contact").send({ topic: "safety", name: "Kemi A", email: "kemi@x.test", message: "Someone keeps posting my address in a group." }).expect(201);
      expect(res.body).toMatchObject({ status: "received" });
      expect(t.outbox.find((m) => m.to === "kemi@x.test")?.text).toContain("112");
      const inbox = await t.http.get("/api/admin/inbox?source=contact_form").set(t.auth("mod")).expect(200);
      expect(inbox.body.items[0]).toMatchObject({ priority: "high", topic: "safety", from: { name: "Kemi A", email: "kemi@x.test" } });
    });

    it("validation errors come back as 400 with a message", async () => {
      const res = await t.http.post("/api/contact").send({ topic: "general", name: "K", email: "not-an-email", message: "short" }).expect(400);
      expect(res.body.message).toBeTruthy();
    });

    it("AI pilot de-duplicates on email + institution; talent network updates in place", async () => {
      const body = { name: "Dr Bisi", email: "bisi@unilag.test", institution: "University of Lagos", institutionType: "university" };
      const a = await t.http.post("/api/ai/pilot-requests").send(body).expect(201);
      const b = await t.http.post("/api/ai/pilot-requests").send({ ...body, institution: "university  of lagos", subjects: "Biochemistry" }).expect(201);
      expect(a.body.id).toBe(b.body.id);
      expect(t.outbox.filter((m) => m.to === "bisi@unilag.test")).toHaveLength(1);
      const t1 = await t.http.post("/api/careers/talent-network").send({ name: "Ife", email: "ife@x.test", team: "design", city: "Lagos" }).expect(201);
      const t2 = await t.http.post("/api/careers/talent-network").send({ name: "Ife O", email: "IFE@x.test", team: "engineering", city: "Abuja", link: "https://github.com/ife" }).expect(201);
      expect(t1.body.id).toBe(t2.body.id);
      await t.http.post("/api/careers/talent-network").send({ name: "Ife", email: "ife@x.test", team: "design", city: "Lagos", link: "http://insecure.test" }).expect(400);
      const pilots = await t.http.get("/api/admin/signups?type=ai_pilot").set(t.auth("admin1")).expect(200);
      expect(pilots.body[0].detail).toContain("Biochemistry");
      await t.http.get("/api/admin/signups?type=talent").set(t.auth("mod")).expect(403);
    });
  });

  describe("support inbox", () => {
    it("in-app help → staff reply by email + notification, assign, resolve", async () => {
      const req = await t.http.post("/api/support").set(t.auth("ada")).send({ topic: "verification", message: "My address check keeps failing although I live on Road 12." }).expect(201);
      await t.http.patch(`/api/admin/inbox/${req.body.id}`).set(t.auth("mod")).send({ assignToMe: true }).expect(200).expect((r) => expect(r.body.assignee.uid).toBe("mod"));
      const replied = await t.http.post(`/api/admin/inbox/${req.body.id}/reply`).set(t.auth("mod")).send({ body: "We've verified you manually. Welcome!", resolve: true }).expect(200);
      expect(replied.body).toMatchObject({ status: "resolved", source: "in_app" });
      expect(replied.body.messages.map((m: { from: string }) => m.from)).toEqual(["user", "staff"]);
      expect(t.outbox.find((m) => m.to === "ada@test.dev" && m.subject.startsWith("Re:"))).toBeTruthy();
      const notes = await t.http.get("/api/notifications").set(t.auth("ada")).expect(200);
      expect(notes.body.some((n: { title: string }) => n.title === "The myHoodora team replied")).toBe(true);
    });

    it("feedback lands in the inbox too", async () => {
      await t.http.post("/api/feedback").set(t.auth("ada")).send({ kind: "idea", message: "Please add a dark mode." }).expect(204);
      const inbox = await t.http.get("/api/admin/inbox?source=feedback").set(t.auth("mod")).expect(200);
      expect(inbox.body.items[0]).toMatchObject({ priority: "low", from: { uid: "ada" }, messages: [{ body: "Please add a dark mode." }] });
    });
  });

  describe("Business Pages", () => {
    let id: string;

    it("applies publicly, validates Nigerian phone numbers and CAC format", async () => {
      await t.http.post("/api/business-pages/applications").send(application({ phone: "08031234567" })).expect(400);
      await t.http.post("/api/business-pages/applications").send(application({ cacNumber: "12345" })).expect(400);
      const res = await t.http.post("/api/business-pages/applications").send(application()).expect(201);
      expect(res.body.status).toBe("pending_review");
      id = res.body.id;
      const overview = await t.http.get("/api/admin/overview").set(t.auth("admin1")).expect(200);
      expect(overview.body.attention.businessApplications).toBe(1);
    });

    it("moderators can view but not decide; request_info needs a message", async () => {
      await t.http.get(`/api/admin/businesses/${id}`).set(t.auth("mod")).expect(200);
      await t.http.post(`/api/admin/businesses/${id}/actions`).set(t.auth("mod")).send({ action: "approve" }).expect(403);
      await t.http.post(`/api/admin/businesses/${id}/actions`).set(t.auth("admin1")).send({ action: "request_info" }).expect(400);
    });

    it("approval emails a single-use claim link that links the page to an account", async () => {
      const detail = await t.http.post(`/api/admin/businesses/${id}/actions`).set(t.auth("admin1")).send({ action: "approve", cac: "matched" }).expect(201);
      expect(detail.body).toMatchObject({ status: "verified", checks: { phone: "verified", cac: "matched" } });
      const mail = [...t.outbox].reverse().find((m) => m.to === "nkechi@kitchen.test")!;
      const token = decodeURIComponent(mail.text.match(/claim\?token=([^\s]+)/)![1]!);
      const claimed = await t.http.post("/api/business-pages/claim").set(t.auth("ada")).send({ token }).expect(200);
      expect(claimed.body).toMatchObject({ id, businessName: "Mama Nkechi Kitchen" });
      await t.http.post("/api/business-pages/claim").set(t.auth("ada")).send({ token }).expect(400);
      expect((await t.http.get("/api/business-pages/mine").set(t.auth("ada")).expect(200)).body[0].id).toBe(id);
    });

    it("tabs, ads waitlist and suspension", async () => {
      expect((await t.http.get("/api/admin/businesses?tab=verified").set(t.auth("admin1")).expect(200)).body.total).toBe(1);
      expect((await t.http.get("/api/admin/signups?type=business_ads").set(t.auth("admin1")).expect(200)).body[0].detail).toContain("Mama Nkechi Kitchen");
      await t.http.post(`/api/admin/businesses/${id}/actions`).set(t.auth("admin1")).send({ action: "reinstate" }).expect(409);
      await t.http.post(`/api/admin/businesses/${id}/actions`).set(t.auth("admin1")).send({ action: "suspend", reason: "Reported for fake reviews" }).expect(201);
      expect((await t.http.get("/api/admin/businesses?tab=reported").set(t.auth("admin1")).expect(200)).body.items[0].status).toBe("suspended");
    });
  });
});
